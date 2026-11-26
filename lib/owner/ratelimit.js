import { store, PATHS } from './store.js';
import { sha256 } from './crypto.js';

export function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || String(req.headers['x-real-ip'] || '') || req.socket?.remoteAddress || 'unknown';
}

// Fixed-window counter stored in Blob. Not strictly atomic, but enough to stop brute force.
export async function hit(bucket, limit, windowSeconds) {
  const path = PATHS.rate(sha256(bucket));
  const now = Date.now();
  let rec = await store.read(path);
  if (!rec || now - rec.start > windowSeconds * 1000) rec = { start: now, count: 0 };
  rec.count += 1;
  await store.write(path, rec);
  const retryAfter = Math.max(1, Math.ceil((rec.start + windowSeconds * 1000 - now) / 1000));
  return { allowed: rec.count <= limit, retryAfter };
}

export async function check(buckets) {
  for (const [bucket, limit, windowSeconds] of buckets) {
    const result = await hit(bucket, limit, windowSeconds);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}
