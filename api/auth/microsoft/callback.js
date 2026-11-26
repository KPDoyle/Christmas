import { decrypt, safeEqual } from '../../../lib/owner/crypto.js';
import { ownerSession, parseCookies, appendCookie, cookie, OAUTH_COOKIE } from '../../../lib/owner/session.js';
import { completeAuthorization } from '../../../lib/owner/graph.js';

// Redirect URI registered in Entra: https://calendar-post-kevindoyle.vercel.app/api/auth/microsoft/callback
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  appendCookie(res, cookie(OAUTH_COOKIE, '', { maxAge: 0 }));
  const back = message => res.redirect(302, '/owner.html#' + (message ? 'error=' + encodeURIComponent(message) : 'connected=1'));
  try {
    if (!await ownerSession(req)) return back('Your owner session ended. Sign in and connect again.');
    if (req.query.error) return back('Microsoft sign-in was cancelled or refused (' + String(req.query.error).slice(0, 60) + ').');
    const raw = parseCookies(req)[OAUTH_COOKIE];
    if (!raw) return back('The sign-in request expired. Try again.');
    const saved = JSON.parse(decrypt(raw, 'oauth-state'));
    if (saved.exp < Date.now() || !safeEqual(saved.state, req.query.state)) return back('The sign-in request did not match. Try again.');
    if (typeof req.query.code !== 'string') return back('Microsoft did not return a sign-in code.');
    await completeAuthorization(req.query.code, saved.verifier);
    return back();
  } catch (err) {
    console.error('Microsoft callback failed:', err.message);
    return back(err.status === 400 ? err.message : 'Could not connect Microsoft 365. Try again.');
  }
}
