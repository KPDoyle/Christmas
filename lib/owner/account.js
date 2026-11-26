import { store, PATHS } from './store.js';
import { hashPassword, verifyPassword, randomToken, sha256 } from './crypto.js';
import { config } from './config.js';

export const RESET_TTL_MS = 30 * 60 * 1000;
export const MIN_PASSWORD = 12;

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD || password.length > 200) {
    throw Object.assign(new Error('Use a password of ' + MIN_PASSWORD + ' to 200 characters.'), { status: 400 });
  }
}

const accountPath=email=>email===config().ownerEmail?PATHS.account:'organisers/'+sha256(email)+'.json';
export const getAccount = (email=config().ownerEmail) => store.read(accountPath(email));

export async function createAccount(password,email=config().ownerEmail) {
  validatePassword(password);
  const now = new Date().toISOString();
  const account = { email, passwordHash: await hashPassword(password), sessionVersion: randomToken(12), passwordChangedAt: now, createdAt: now };
  await store.write(accountPath(email), account,true);
  return account;
}

export async function checkLogin(email, password) {
  const account = await getAccount(String(email || '').trim().toLowerCase());
  const emailOk = Boolean(account) && String(email || '').trim().toLowerCase() === account.email;
  // Always run scrypt so the response time does not reveal whether the email matched.
  const passOk = await verifyPassword(String(password || ''), emailOk ? account.passwordHash : null);
  return emailOk && passOk ? account : null;
}

export async function setPassword(account, password) {
  validatePassword(password);
  const next = { ...account, passwordHash: await hashPassword(password), sessionVersion: randomToken(12), passwordChangedAt: new Date().toISOString() };
  await store.write(accountPath(account.email), next);
  return next;
}

export async function issueResetToken(account) {
  const token = randomToken(32);
  await store.write(PATHS.reset(sha256(token)), { email:account.email, expires: Date.now() + RESET_TTL_MS, passwordChangedAt: account.passwordChangedAt });
  return token;
}

// Single use: the token record is deleted before the password is changed, and any token
// issued before the last password change is rejected.
export async function consumeResetToken(token, password) {
  validatePassword(password);
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const path = PATHS.reset(sha256(token));
  const record = await store.read(path);
  if (!record) return null;
  await store.remove(path);
  const account = await getAccount(record.email);
  if (!account || record.expires < Date.now() || record.passwordChangedAt !== account.passwordChangedAt) return null;
  return setPassword(account, password);
}
