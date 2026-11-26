import { scrypt as scryptCb, randomBytes, createHash, createHmac, createCipheriv, createDecipheriv, timingSafeEqual, hkdfSync } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';

const scrypt = promisify(scryptCb);
// scrypt parameters: N=2^15, r=8, p=1 (~32 MiB, well under the 128 MiB maxmem below).
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const KEYLEN = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(String(password).normalize('NFKC'), salt, KEYLEN, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

// A fixed hash used when no account exists so that login timing does not reveal it.
let dummyHash;
export async function verifyPassword(password, stored) {
  if (!stored) {
    dummyHash ||= await hashPassword('not-a-real-password-' + randomBytes(8).toString('hex'));
    stored = dummyHash;
    await verifyPassword(password, stored);
    return false;
  }
  const [alg, N, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scrypt(String(password).normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length,
    { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = value => createHash('sha256').update(String(value)).digest('hex');

export function safeEqual(a, b) {
  const x = createHash('sha256').update(String(a ?? '')).digest();
  const y = createHash('sha256').update(String(b ?? '')).digest();
  return timingSafeEqual(x, y);
}

function masterKey() {
  const raw = config().tokenEncryptionKey;
  if (!raw) throw Object.assign(new Error('TOKEN_ENCRYPTION_KEY is not set'), { status: 503 });
  let key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length < 32) throw Object.assign(new Error('TOKEN_ENCRYPTION_KEY must be at least 32 bytes'), { status: 503 });
  return key;
}

// Derive independent sub-keys for encryption and for signing session cookies.
export function subKey(label) {
  return Buffer.from(hkdfSync('sha256', masterKey(), Buffer.from('calendar-post'), Buffer.from(label), 32));
}

export function encrypt(plaintext, label = 'token-encryption') {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', subKey(label), iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decrypt(payload, label = 'token-encryption') {
  const [v, iv, tag, data] = String(payload).split('.');
  if (v !== 'v1') throw new Error('Unknown ciphertext version');
  const decipher = createDecipheriv('aes-256-gcm', subKey(label), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

export function sign(value, label = 'session-signing') {
  return createHmac('sha256', subKey(label)).update(value).digest('base64url');
}

export function pkcePair() {
  const verifier = randomToken(48);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}
