import { waitUntil } from '@vercel/functions';
import { config } from '../lib/owner/config.js';
import { safeEqual, encrypt } from '../lib/owner/crypto.js';
import { getAccount, createAccount, checkLogin, setPassword, issueResetToken, consumeResetToken } from '../lib/owner/account.js';
import { ownerSession, createSessionCookie, clearSessionCookie, appendCookie, cookie, OAUTH_COOKIE } from '../lib/owner/session.js';
import { check, clientIp } from '../lib/owner/ratelimit.js';
import { startAuthorization, senderStatus, disconnectSender } from '../lib/owner/graph.js';
import { sendResetEmail, sendTestEmail } from '../lib/owner/mail.js';

const RESET_MESSAGE = 'If that email belongs to the calendar owner, a reset link is on its way. It expires in 30 minutes.';
const LOGIN_FAILED = 'Email or password is incorrect.';

function tooMany(res, result) {
  res.setHeader('Retry-After', String(result.retryAfter));
  return res.status(429).send('Too many attempts. Try again in ' + Math.ceil(result.retryAfter / 60) + ' minutes.');
}

// Cross-site request forgery guard for state-changing requests: JSON only, and same origin when an Origin header is sent.
function sameOriginJson(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const action = String(req.query.action || '');
  const ip = clientIp(req);
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    if (req.method === 'GET' && action === 'status') {
      const session = await ownerSession(req);
      const account = session?.account || await getAccount();
      const out = { setupRequired: !account, loggedIn: Boolean(session) };
      if (session) {
        out.email = session.account.email;
        out.sender = await senderStatus();
      }
      return res.json(out);
    }

    if (req.method === 'GET' && action === 'ms-connect') {
      if (!await ownerSession(req)) return res.redirect(302, '/owner.html#error=' + encodeURIComponent('Sign in first.'));
      const { url, state, verifier } = startAuthorization();
      const payload = encrypt(JSON.stringify({ state, verifier, exp: Date.now() + 10 * 60 * 1000 }), 'oauth-state');
      appendCookie(res, cookie(OAUTH_COOKIE, payload, { maxAge: 600 }));
      return res.redirect(302, url);
    }

    if (req.method !== 'POST') return res.status(405).end();
    if (!sameOriginJson(req)) return res.status(400).send('Send JSON from the calendar site.');

    if (action === 'setup') {
      const limit = await check([['setup:ip:' + ip, 5, 900]]);
      if (!limit.allowed) return tooMany(res, limit);
      const c = config();
      if (!c.calendarKey || !safeEqual(body.key, c.calendarKey)) return res.status(403).send('The calendar admin key is not correct.');
      if (await getAccount()) return res.status(409).send('The owner account is already set up. Sign in or reset the password.');
      const account = await createAccount(body.password);
      appendCookie(res, createSessionCookie(account));
      return res.json({ ok: true, email: account.email });
    }

    if (action === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      const limit = await check([['login:ip:' + ip, 5, 900], ['login:global', 30, 3600]]);
      if (!limit.allowed) return tooMany(res, limit);
      const account = await checkLogin(email, body.password);
      if (!account) return res.status(401).send(LOGIN_FAILED);
      appendCookie(res, createSessionCookie(account));
      return res.json({ ok: true });
    }

    if (action === 'logout') {
      appendCookie(res, clearSessionCookie());
      return res.json({ ok: true });
    }

    if (action === 'forgot') {
      const email = String(body.email || '').trim().toLowerCase();
      const limit = await check([['forgot:ip:' + ip, 5, 3600], ['forgot:global', 10, 3600]]);
      if (!limit.allowed) return tooMany(res, limit);
      const account = await getAccount();
      if (account && email === account.email) {
        // Send after responding, so timing is the same whether or not the email matched.
        const work = issueResetToken(account).then(token => sendResetEmail(account.email, token))
          .catch(err => console.error('Password reset email failed:', err.message));
        waitUntil(work);
      }
      return res.json({ ok: true, message: RESET_MESSAGE });
    }

    if (action === 'reset') {
      const limit = await check([['reset:ip:' + ip, 10, 900]]);
      if (!limit.allowed) return tooMany(res, limit);
      const account = await consumeResetToken(body.token, body.password);
      if (!account) return res.status(400).send('This reset link is invalid, expired or already used. Ask for a new one.');
      appendCookie(res, createSessionCookie(account));
      return res.json({ ok: true });
    }

    const session = await ownerSession(req);
    if (!session) return res.status(401).send('Sign in first.');

    if (action === 'change-password') {
      const limit = await check([['change:ip:' + ip, 5, 900]]);
      if (!limit.allowed) return tooMany(res, limit);
      if (!await checkLogin(session.account.email, body.current)) return res.status(401).send('Your current password is not correct.');
      const account = await setPassword(session.account, body.password);
      appendCookie(res, createSessionCookie(account));
      return res.json({ ok: true });
    }

    if (action === 'ms-disconnect') {
      await disconnectSender();
      return res.json({ ok: true });
    }

    if (action === 'ms-test') {
      const limit = await check([['mstest:ip:' + ip, 5, 3600]]);
      if (!limit.allowed) return tooMany(res, limit);
      await sendTestEmail(session.account.email);
      return res.json({ ok: true, sentTo: session.account.email });
    }

    return res.status(404).end();
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('owner api error', action, err.message);
    return res.status(status).send(status === 500 ? 'Something went wrong.' : err.message);
  }
}

