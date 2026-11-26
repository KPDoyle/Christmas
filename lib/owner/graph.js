import { config, MS_SCOPES, msConfigured } from './config.js';
import { encrypt, decrypt, pkcePair, randomToken } from './crypto.js';
import { store, PATHS } from './store.js';

const authority = c => 'https://login.microsoftonline.com/' + encodeURIComponent(c.msTenantId) + '/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';

function fail(message, status = 502) { return Object.assign(new Error(message), { status }); }

// Step 1 of auth-code + PKCE: returns the Microsoft sign-in URL and the state to keep.
export function startAuthorization() {
  const c = config();
  if (!msConfigured(c)) throw fail('Microsoft 365 settings are missing on the server.', 503);
  const { verifier, challenge } = pkcePair();
  const state = randomToken(24);
  const url = new URL(authority(c) + '/authorize');
  url.search = new URLSearchParams({
    client_id: c.msClientId,
    response_type: 'code',
    redirect_uri: c.msRedirectUri,
    response_mode: 'query',
    scope: MS_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    login_hint: c.senderEmail,
    prompt: 'select_account',
  }).toString();
  return { url: url.toString(), state, verifier };
}

async function tokenRequest(params) {
  const c = config();
  const r = await fetch(authority(c) + '/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.msClientId, client_secret: c.msClientSecret, scope: MS_SCOPES, ...params }).toString(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) {
    const err = fail('Microsoft token request failed: ' + (data.error || r.status));
    err.code = data.error;
    throw err;
  }
  return data;
}

async function saveTokens(data, account, previous = {}) {
  const record = {
    ...previous,
    account: account || previous.account,
    refreshToken: data.refresh_token ? encrypt(data.refresh_token) : previous.refreshToken,
    accessToken: encrypt(data.access_token),
    accessTokenExpires: Date.now() + (Number(data.expires_in || 3600) - 300) * 1000,
    updatedAt: new Date().toISOString(),
  };
  if (!record.refreshToken) throw fail('Microsoft did not return a refresh token. Check the offline_access permission.');
  await store.write(PATHS.sender, record);
  return record;
}

// Step 2: exchange the code, confirm the signed-in mailbox is the expected sender, store tokens.
export async function completeAuthorization(code, verifier) {
  const c = config();
  const data = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: c.msRedirectUri, code_verifier: verifier });
  const me = await fetch(GRAPH + '/me?$select=mail,userPrincipalName,displayName', { headers: { Authorization: 'Bearer ' + data.access_token } });
  const profile = await me.json().catch(() => ({}));
  if (!me.ok) throw fail('Could not read the Microsoft 365 profile.');
  const address = String(profile.mail || profile.userPrincipalName || '').toLowerCase();
  if (address !== c.senderEmail) throw fail('Signed in as ' + (address || 'an unknown account') + '. Sign in as ' + c.senderEmail + '.', 400);
  return saveTokens(data, { email: address, name: profile.displayName || '' }, { connectedAt: new Date().toISOString() });
}

export async function senderStatus() {
  const c = config();
  const record = await store.read(PATHS.sender);
  return {
    configured: msConfigured(c),
    connected: Boolean(record?.refreshToken) && !record.needsReconnect,
    needsReconnect: Boolean(record?.needsReconnect),
    email: record?.account?.email || null,
    expectedEmail: c.senderEmail,
    connectedAt: record?.connectedAt || null,
    lastError: record?.lastError || null,
  };
}

export async function disconnectSender() { await store.remove(PATHS.sender); }

async function accessToken() {
  const record = await store.read(PATHS.sender);
  if (!record?.refreshToken) throw fail('The Microsoft 365 sender is not connected.', 503);
  if (record.accessToken && record.accessTokenExpires > Date.now()) return decrypt(record.accessToken);
  try {
    const data = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decrypt(record.refreshToken) });
    const { lastError, needsReconnect, ...rest } = record;
    const saved = await saveTokens(data, null, rest);
    return decrypt(saved.accessToken);
  } catch (err) {
    if (err.code === 'invalid_grant' || err.code === 'interaction_required') {
      await store.write(PATHS.sender, { ...record, needsReconnect: true, lastError: err.message, accessToken: null });
    }
    throw err;
  }
}

export async function sendMail({ to, subject, html }) {
  const token = await accessToken();
  const r = await fetch(GRAPH + '/me/sendMail', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: { subject, body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: to } }] },
      saveToSentItems: false,
    }),
  });
  if (r.status !== 202 && !r.ok) throw fail('Microsoft Graph sendMail failed with status ' + r.status);
  return true;
}
