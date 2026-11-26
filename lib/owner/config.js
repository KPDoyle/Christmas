// Central place for the owner-login / Microsoft 365 sender configuration.
const DEFAULT_OWNER = 'kevin.doyle@adarogroup.eu';

export function config() {
  const env = process.env;
  const redirectUri = env.MS_REDIRECT_URI || '';
  let base = env.APP_BASE_URL || '';
  if (!base && redirectUri) {
    try { base = new URL(redirectUri).origin; } catch { base = ''; }
  }
  return {
    ownerEmail: (env.OWNER_EMAIL || DEFAULT_OWNER).trim().toLowerCase(),
    senderEmail: (env.MS_SENDER_EMAIL || env.OWNER_EMAIL || DEFAULT_OWNER).trim().toLowerCase(),
    calendarKey: env.CALENDAR_KEY || '',
    msClientId: env.MS_CLIENT_ID || '',
    msClientSecret: env.MS_CLIENT_SECRET || '',
    msTenantId: env.MS_TENANT_ID || '',
    msRedirectUri: redirectUri,
    tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY || '',
    baseUrl: base.replace(/\/+$/, ''),
  };
}

export const MS_SCOPES = 'offline_access Mail.Send User.Read';

export function msConfigured(c = config()) {
  return Boolean(c.msClientId && c.msClientSecret && c.msTenantId && c.msRedirectUri && c.tokenEncryptionKey);
}
