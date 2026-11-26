import { get, put, del } from '@vercel/blob';

// Small JSON store on top of private Vercel Blob. Swappable for tests.
const blobStore = {
  async read(path) {
    const b = await get(path, { access: 'private', useCache: false });
    return b?.statusCode === 200 ? new Response(b.stream).json() : null;
  },
  async write(path, value) {
    await put(path, JSON.stringify(value), { access: 'private', allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 });
  },
  async remove(path) {
    try { await del(path); } catch { /* already gone */ }
  },
};

let impl = blobStore;
export const store = {
  read: path => impl.read(path),
  write: (path, value) => impl.write(path, value),
  remove: path => impl.remove(path),
};

export function setStore(next) { impl = next || blobStore; }

export function memoryStore() {
  const data = new Map();
  return {
    data,
    async read(path) { return data.has(path) ? JSON.parse(data.get(path)) : null; },
    async write(path, value) { data.set(path, JSON.stringify(value)); },
    async remove(path) { data.delete(path); },
  };
}

export const PATHS = {
  account: 'owner/account.json',
  sender: 'owner/ms-sender.json',
  reset: hash => 'owner/reset-tokens/' + hash + '.json',
  rate: hash => 'owner/rate-limits/' + hash + '.json',
};
