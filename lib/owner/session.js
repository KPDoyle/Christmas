import {getAccount} from './account.js';
import {config} from './config.js';
import { sign, safeEqual } from './crypto.js';
import { store, PATHS } from './store.js';

export const SESSION_COOKIE = '__Host-cp_owner';
export const OAUTH_COOKIE = '__Host-cp_ms_oauth';
// The browser sends this value as its Bearer token ("#admin=session") to ask the
// API to authorise it with the owner session cookie instead of CALENDAR_KEY.
// Requiring the header as well as the cookie also blocks cross-site request forgery.
export const OWNER_SESSION_TOKEN = 'session';
const SESSION_TTL = 12 * 60 * 60; // 12 hours

export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, { maxAge, sameSite = 'Lax' } = {}) {
  const parts = [name + '=' + encodeURIComponent(value), 'Path=/', 'HttpOnly', 'Secure', 'SameSite=' + sameSite];
  if (maxAge !== undefined) parts.push('Max-Age=' + maxAge);
  return parts.join('; ');
}

export function appendCookie(res, value) {
  const prev = res.getHeader?.('Set-Cookie');
  const list = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  res.setHeader('Set-Cookie', [...list, value]);
}

export function createSessionCookie(account) {
  const payload = Buffer.from(JSON.stringify({ email:account.email, v: account.sessionVersion, exp: Math.floor(Date.now() / 1000) + SESSION_TTL })).toString('base64url');
  return cookie(SESSION_COOKIE, payload + '.' + sign(payload), { maxAge: SESSION_TTL });
}

export const clearSessionCookie = () => cookie(SESSION_COOKIE, '', { maxAge: 0 });

export async function accountSession(req) {
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (!raw) return null;
  const [payload, mac] = raw.split('.');
  if (!payload || !mac) return null;
  try {
    if (!safeEqual(sign(payload), mac)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now() / 1000) return null;
    const account = await getAccount(data.email);
    if (!account || account.sessionVersion !== data.v) return null;
    return { account };
  } catch {
    return null;
  }
}

// Shared admin check for the existing APIs: CALENDAR_KEY (fallback) or owner session.
export async function ownerSession(req){
  const session=await accountSession(req);
  return session?.account.email===config().ownerEmail?session:null;
}
export async function isAdmin(req, token) {
  if (token === OWNER_SESSION_TOKEN) return Boolean(await ownerSession(req));
  return false;
}
