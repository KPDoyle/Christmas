import { randomBytes } from 'node:crypto';
process.env.CALENDAR_KEY = 'test-calendar-key';
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.MS_CLIENT_ID = '0b67048b-282b-4c3d-9347-c94baf6311b3';
process.env.MS_CLIENT_SECRET = 'test-secret';
process.env.MS_TENANT_ID = '2cb55343-b529-4ac7-b316-e5501e55b58d';
process.env.MS_REDIRECT_URI = 'https://calendar-post-kevindoyle.vercel.app/api/auth/microsoft/callback';
delete process.env.OWNER_EMAIL; delete process.env.MS_SENDER_EMAIL; delete process.env.APP_BASE_URL;

export function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined, location: null };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  res.getHeader = k => res.headers[k.toLowerCase()];
  res.status = code => { res.statusCode = code; return res; };
  res.send = body => { res.body = body; return res; };
  res.json = body => { res.body = body; return res; };
  res.end = () => res;
  res.redirect = (code, url) => { res.statusCode = code; res.location = url; return res; };
  return res;
}

export function fakeReq({ method = 'GET', query = {}, body, cookie = '', headers = {}, ip = '203.0.113.1' } = {}) {
  return {
    method, query, body,
    headers: { host: 'calendar-post-kevindoyle.vercel.app', 'x-forwarded-for': ip, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
  };
}

// Turn Set-Cookie headers into a Cookie header value.
export function cookiesFrom(res, jar = {}) {
  const list = [].concat(res.headers['set-cookie'] || []);
  for (const c of list) {
    const [pair, ...attrs] = c.split('; ');
    const i = pair.indexOf('=');
    const name = pair.slice(0, i), value = pair.slice(i + 1);
    if (attrs.includes('Max-Age=0')) delete jar[name]; else jar[name] = value;
  }
  return jar;
}
export const cookieHeader = jar => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');

export function mockFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    for (const [match, handler] of routes) {
      if (String(url).includes(match)) {
        const { status = 200, json } = await handler(String(url), init);
        return new Response(json === undefined ? null : JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
      }
    }
    throw new Error('Unexpected fetch ' + url);
  };
  return calls;
}
