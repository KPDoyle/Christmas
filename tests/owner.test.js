import './helpers.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeReq, fakeRes, cookiesFrom, cookieHeader, mockFetch } from './helpers.js';
import { setStore, memoryStore, PATHS } from '../lib/owner/store.js';
import { hashPassword, verifyPassword, encrypt, decrypt } from '../lib/owner/crypto.js';
import { isAdmin, OWNER_SESSION_TOKEN } from '../lib/owner/session.js';
import owner from '../api/owner.js';
import callback from '../api/auth/microsoft/callback.js';

const OWNER = 'kevin.doyle@adarogroup.eu';
const PASSWORD = 'correct horse battery staple';
let mem, ipCounter = 0;
const nextIp = () => '198.51.100.' + (++ipCounter % 250);
const tick = () => new Promise(r => setTimeout(r, 30));

async function call(action, { method = 'POST', body = {}, jar = {}, ip = nextIp(), headers } = {}) {
  const res = fakeRes();
  await owner(fakeReq({ method, query: { action }, body: method === 'POST' ? body : undefined, cookie: cookieHeader(jar), ip, headers }), res);
  cookiesFrom(res, jar);
  return res;
}
async function setUp() {
  const jar = {};
  const res = await call('setup', { body: { key: 'test-calendar-key', password: PASSWORD }, jar });
  assert.equal(res.statusCode, 200);
  return jar;
}

beforeEach(() => { mem = memoryStore(); setStore(mem); mockFetch([]); });

test('scrypt hashes verify and reject wrong passwords', async () => {
  const h = await hashPassword('a long enough password');
  assert.match(h, /^scrypt\$/);
  assert.equal(await verifyPassword('a long enough password', h), true);
  assert.equal(await verifyPassword('wrong password!!', h), false);
  assert.equal(await verifyPassword('anything', null), false);
});

test('AES-GCM encryption round-trips and detects tampering', () => {
  const box = encrypt('refresh-token-value');
  assert.equal(decrypt(box), 'refresh-token-value');
  assert.ok(!box.includes('refresh-token-value'));
  const parts = box.split('.'); parts[3] = Buffer.from('xxxx').toString('base64url');
  assert.throws(() => decrypt(parts.join('.')));
});

test('setup is gated by CALENDAR_KEY and only works once', async () => {
  let res = await call('setup', { body: { key: 'nope', password: PASSWORD } });
  assert.equal(res.statusCode, 403);
  res = await call('setup', { body: { key: 'test-calendar-key', password: 'short' } });
  assert.equal(res.statusCode, 400);
  const jar = await setUp();
  assert.ok(jar['__Host-cp_owner']);
  const account = await mem.read(PATHS.account);
  assert.equal(account.email, OWNER);
  assert.ok(!JSON.stringify(account).includes(PASSWORD));
  res = await call('setup', { body: { key: 'test-calendar-key', password: PASSWORD } });
  assert.equal(res.statusCode, 409);
});

test('session cookie is HttpOnly, Secure and SameSite', async () => {
  const res = await call('setup', { body: { key: 'test-calendar-key', password: PASSWORD } });
  const c = [].concat(res.headers['set-cookie'])[0];
  assert.match(c, /^__Host-cp_owner=/);
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(c.includes(attr), attr);
});

test('login: same error for wrong email and wrong password, success sets session', async () => {
  await setUp();
  const a = await call('login', { body: { email: 'someone@else.com', password: PASSWORD } });
  const b = await call('login', { body: { email: OWNER, password: 'wrong password here' } });
  assert.equal(a.statusCode, 401); assert.equal(b.statusCode, 401); assert.equal(a.body, b.body);
  const jar = {};
  const ok = await call('login', { body: { email: 'Kevin.Doyle@AdaroGroup.eu ', password: PASSWORD }, jar });
  assert.equal(ok.statusCode, 200);
  const status = await call('status', { method: 'GET', jar });
  assert.equal(status.body.loggedIn, true);
  assert.equal(status.body.sender.connected, false);
});

test('login is rate limited per IP', async () => {
  await setUp();
  const ip = '192.0.2.77';
  for (let i = 0; i < 5; i++) assert.equal((await call('login', { body: { email: OWNER, password: 'bad password ' + i }, ip })).statusCode, 401);
  const res = await call('login', { body: { email: OWNER, password: PASSWORD }, ip });
  assert.equal(res.statusCode, 429);
  assert.ok(res.headers['retry-after']);
});

test('state-changing requests must be same-origin JSON', async () => {
  const res = fakeRes();
  await owner({ method: 'POST', query: { action: 'login' }, body: 'email=x', headers: { host: 'calendar-post-kevindoyle.vercel.app', 'content-type': 'application/x-www-form-urlencoded' } }, res);
  assert.equal(res.statusCode, 400);
  const cross = await call('login', { body: { email: OWNER, password: PASSWORD }, headers: { origin: 'https://evil.example' } });
  assert.equal(cross.statusCode, 400);
});

function senderConnected() {
  return mem.write(PATHS.sender, { account: { email: OWNER }, refreshToken: encrypt('rt-1'), accessToken: encrypt('at-1'), accessTokenExpires: Date.now() + 600000, connectedAt: new Date().toISOString() });
}

test('forgot password: no enumeration, Graph sendMail, single-use expiring token', async () => {
  const oldJar = await setUp();
  await senderConnected();
  const sent = [];
  const calls = mockFetch([['graph.microsoft.com/v1.0/me/sendMail', (url, init) => { sent.push(JSON.parse(init.body)); return { status: 202 }; }]]);

  const unknown = await call('forgot', { body: { email: 'nobody@example.com' } });
  const known = await call('forgot', { body: { email: OWNER } });
  await tick();
  assert.deepEqual(unknown.body, known.body);
  assert.equal(sent.length, 1);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer at-1');
  const msg = sent[0].message;
  assert.equal(msg.toRecipients[0].emailAddress.address, OWNER);
  assert.equal(sent[0].saveToSentItems, false);
  const token = decodeURIComponent(msg.body.content.match(/#reset=([^"]+)"/)[1]);
  assert.ok(msg.body.content.includes('https://calendar-post-kevindoyle.vercel.app/owner.html#reset='));
  // Stored hashed, not in clear.
  assert.ok(![...mem.data.keys(), ...mem.data.values()].some(v => v.includes(token)));

  const NEW = 'a brand new password 2026';
  const jar = {};
  const ok = await call('reset', { body: { token, password: NEW }, jar });
  assert.equal(ok.statusCode, 200);
  assert.ok(jar['__Host-cp_owner']);
  const again = await call('reset', { body: { token, password: 'another new password!' } });
  assert.equal(again.statusCode, 400);
  // Old sessions are signed out after a reset.
  assert.equal((await call('status', { method: 'GET', jar: oldJar })).body.loggedIn, false);
  assert.equal((await call('login', { body: { email: OWNER, password: NEW } })).statusCode, 200);
});

test('expired reset tokens are rejected', async () => {
  await setUp();
  const { issueResetToken, getAccount } = await import('../lib/owner/account.js');
  const token = await issueResetToken(await getAccount());
  const { sha256 } = await import('../lib/owner/crypto.js');
  const rec = await mem.read(PATHS.reset(sha256(token)));
  await mem.write(PATHS.reset(sha256(token)), { ...rec, expires: Date.now() - 1 });
  assert.equal((await call('reset', { body: { token, password: 'a brand new password 2026' } })).statusCode, 400);
});

test('forgot password does not throw when the sender is not connected', async () => {
  await setUp();
  const res = await call('forgot', { body: { email: OWNER } });
  await tick();
  assert.equal(res.statusCode, 200);
});

test('Microsoft connect uses auth code + PKCE and stores the refresh token encrypted', async () => {
  const jar = await setUp();
  const start = await call('ms-connect', { method: 'GET', jar });
  assert.equal(start.statusCode, 302);
  const url = new URL(start.location);
  assert.equal(url.origin + url.pathname, 'https://login.microsoftonline.com/2cb55343-b529-4ac7-b316-e5501e55b58d/oauth2/v2.0/authorize');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('scope'), 'offline_access Mail.Send User.Read');
  assert.equal(url.searchParams.get('redirect_uri'), process.env.MS_REDIRECT_URI);
  assert.equal(url.searchParams.get('login_hint'), OWNER);
  assert.ok(jar['__Host-cp_ms_oauth']);

  let tokenBody;
  mockFetch([
    ['/oauth2/v2.0/token', (u, init) => { tokenBody = new URLSearchParams(init.body); return { json: { access_token: 'at-new', refresh_token: 'rt-secret-123', expires_in: 3600 } }; }],
    ['graph.microsoft.com/v1.0/me?', () => ({ json: { mail: 'Kevin.Doyle@adarogroup.eu', displayName: 'Kevin Doyle' } })],
  ]);
  // State mismatch is refused.
  let res = fakeRes();
  await callback(fakeReq({ query: { code: 'abc', state: 'wrong' }, cookie: cookieHeader(jar) }), res);
  assert.match(res.location, /#error=/);

  res = fakeRes();
  await callback(fakeReq({ query: { code: 'abc', state: url.searchParams.get('state') }, cookie: cookieHeader(jar) }), res);
  assert.equal(res.location, '/owner.html#connected=1');
  assert.equal(tokenBody.get('grant_type'), 'authorization_code');
  assert.ok(tokenBody.get('code_verifier'));
  assert.equal(tokenBody.get('client_secret'), 'test-secret');
  const raw = mem.data.get(PATHS.sender);
  assert.ok(!raw.includes('rt-secret-123') && !raw.includes('at-new'));
  assert.equal(decrypt(JSON.parse(raw).refreshToken), 'rt-secret-123');
  const status = await call('status', { method: 'GET', jar });
  assert.equal(status.body.sender.connected, true);
  assert.equal(status.body.sender.email, OWNER);
});

test('Microsoft connect refuses a different mailbox and requires an owner session', async () => {
  const jar = await setUp();
  const noSession = await call('ms-connect', { method: 'GET' });
  assert.match(noSession.location, /^\/owner\.html#error=/);
  const start = await call('ms-connect', { method: 'GET', jar });
  const state = new URL(start.location).searchParams.get('state');
  mockFetch([
    ['/oauth2/v2.0/token', () => ({ json: { access_token: 'a', refresh_token: 'r', expires_in: 3600 } })],
    ['graph.microsoft.com/v1.0/me?', () => ({ json: { mail: 'someone@adarogroup.eu' } })],
  ]);
  const res = fakeRes();
  await callback(fakeReq({ query: { code: 'abc', state }, cookie: cookieHeader(jar) }), res);
  assert.match(decodeURIComponent(res.location), /Sign in as kevin\.doyle@adarogroup\.eu/);
  assert.equal(mem.data.has(PATHS.sender), false);
});

test('expired access token is refreshed and the rotated refresh token saved', async () => {
  const jar = await setUp();
  await mem.write(PATHS.sender, { account: { email: OWNER }, refreshToken: encrypt('rt-old'), accessToken: encrypt('at-old'), accessTokenExpires: Date.now() - 1 });
  let refreshBody;
  const calls = mockFetch([
    ['/oauth2/v2.0/token', (u, init) => { refreshBody = new URLSearchParams(init.body); return { json: { access_token: 'at-fresh', refresh_token: 'rt-rotated', expires_in: 3600 } }; }],
    ['/me/sendMail', () => ({ status: 202 })],
  ]);
  const res = await call('ms-test', { jar });
  assert.equal(res.statusCode, 200);
  assert.equal(refreshBody.get('grant_type'), 'refresh_token');
  assert.equal(refreshBody.get('refresh_token'), 'rt-old');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer at-fresh');
  assert.equal(decrypt((await mem.read(PATHS.sender)).refreshToken), 'rt-rotated');
});

test('revoked refresh token marks the sender as needing reconnection', async () => {
  const jar = await setUp();
  await mem.write(PATHS.sender, { account: { email: OWNER }, refreshToken: encrypt('rt-old'), accessTokenExpires: 0 });
  mockFetch([['/oauth2/v2.0/token', () => ({ status: 400, json: { error: 'invalid_grant' } })]]);
  const res = await call('ms-test', { jar });
  assert.equal(res.statusCode, 502);
  const status = await call('status', { method: 'GET', jar });
  assert.equal(status.body.sender.connected, false);
  assert.equal(status.body.sender.needsReconnect, true);
});

test('isAdmin accepts CALENDAR_KEY or the owner session, nothing else', async () => {
  const jar = await setUp();
  const req = (cookie) => fakeReq({ cookie: cookie ? cookieHeader(jar) : '' });
  assert.equal(await isAdmin(req(false), 'test-calendar-key'), true);
  assert.equal(await isAdmin(req(true), OWNER_SESSION_TOKEN), true);
  assert.equal(await isAdmin(req(false), OWNER_SESSION_TOKEN), false);
  assert.equal(await isAdmin(req(true), 'some-guest-token'), false);
  assert.equal(await isAdmin(req(true), ''), false);
  await call('logout', { jar });
  assert.equal(await isAdmin(req(true), OWNER_SESSION_TOKEN), false);
});
