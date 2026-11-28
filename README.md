# December Post (Calendar Post)

Christmas advent calendar hosted on Vercel (project `christmas`, https://calendar-post-kevindoyle.vercel.app).
Static front end in `public/`, serverless functions in `api/`, data in private Vercel Blob storage.

## Admin access

There are two ways in to the calendar admin:

1. **Owner login (recommended).** Go to `/owner.html`, sign in with the owner email and password, then
   choose **Open calendar admin** (this opens `/#admin=session`). The browser holds an HttpOnly,
   Secure, SameSite=Lax session cookie (`__Host-cp_owner`, 12 hours). API calls send
   `Authorization: Bearer session`, and the server only treats that as admin when a valid owner
   session cookie is present too.
2. **Shared key (fallback, unchanged).** `/#admin=<CALENDAR_KEY>`, sent as `Authorization: Bearer <CALENDAR_KEY>`.

Recipient invitation links (`#calendar=<id>.<sig>`), preview links (`#test=`) and guest links (`#gift=`) work as before.

## Owner account and password reset

- One-time setup at `/owner.html`: if no owner account exists yet, the page asks for `CALENDAR_KEY`
  and a new password (12–200 characters). The account email is `OWNER_EMAIL`
  (default `kevin.doyle@adarogroup.eu`). Once the account exists, setup is refused.
- Passwords are hashed with scrypt (N=2^15, r=8, p=1, 16-byte salt).
- Login, setup, forgot-password and reset requests are rate limited per IP (counters in Blob,
  `owner/rate-limits/`). Login also has a global limit of 30 attempts per hour.
- Login and forgot-password give the same response whatever the email is, so they don't reveal the
  account (the reset email is sent after the response, and login always runs scrypt).
- Reset tokens are 256-bit random values, stored only as SHA-256 hashes (`owner/reset-tokens/`),
  valid for 30 minutes, deleted on first use, and also invalidated by any later password change.
  The link is `APP_BASE_URL/owner.html#reset=<token>`. The token is in the URL fragment, so it isn't
  sent to servers or in Referer headers.
- A password reset or change signs out every other session.

## Microsoft 365 sender (password-reset emails)

Reset emails are sent **from** `MS_SENDER_EMAIL` (default `kevin.doyle@adarogroup.eu`) **to** the owner
with Microsoft Graph `POST /me/sendMail`, using **delegated** permissions:

1. Sign in at `/owner.html` and choose **Connect Microsoft 365 sender**.
2. This uses the OAuth 2.0 authorisation-code flow with PKCE (S256) and the scopes
   `offline_access Mail.Send User.Read`. Sign in as the sender mailbox. Any other account is refused.
3. The refresh token (and the short-lived access token) are encrypted with AES-256-GCM using a key
   derived from `TOKEN_ENCRYPTION_KEY`, and stored in Blob at `owner/ms-sender.json`. Tokens are
   refreshed automatically and rotated refresh tokens are saved.
4. If the sender isn't connected, or Microsoft revokes the refresh token, the owner page and the
   calendar admin show a warning, and reset emails can't be sent until you reconnect.
   **Send test email** on the owner page checks the connection end to end.

Reset emails use `saveToSentItems: false`, so reset links are not kept in Sent Items.

### Entra (Azure AD) app registration

Already set up in the Adaro Group tenant:

| Setting | Value |
| --- | --- |
| Name | Calendar Post |
| Application (client) ID | `0b67048b-282b-4c3d-9347-c94baf6311b3` |
| Directory (tenant) ID | `2cb55343-b529-4ac7-b316-e5501e55b58d` |
| Supported account types | My organization only (single tenant) |
| Platform | Web |
| Redirect URI | `https://calendar-post-kevindoyle.vercel.app/api/auth/microsoft/callback` |
| API permissions | Microsoft Graph, delegated: `Mail.Send`, `User.Read`, `offline_access`, with admin consent granted |
| Client credentials | A client secret. Put its **Value**, not its Secret ID, in `MS_CLIENT_SECRET` |

To set it up again: Entra admin centre → App registrations → New registration, using the settings above.
Then API permissions → Add → Microsoft Graph → Delegated → add the three permissions → Grant admin consent.
Then Certificates & secrets → New client secret, and copy the **Value** straight away. Client secrets expire,
so renew the secret before it does and update `MS_CLIENT_SECRET`.

## Environment variables

| Name | Required | Value |
| --- | --- | --- |
| `CALENDAR_KEY` | yes (existing) | Shared admin key. Also used to sign invite and preview links and to gate the one-time owner setup. |
| `BLOB_READ_WRITE_TOKEN` | yes (existing) | Vercel Blob store token (set by the Blob integration). |
| `MS_CLIENT_ID` | for reset email | `0b67048b-282b-4c3d-9347-c94baf6311b3` |
| `MS_CLIENT_SECRET` | for reset email | Client secret **Value** from Entra (secret). |
| `MS_TENANT_ID` | for reset email | `2cb55343-b529-4ac7-b316-e5501e55b58d` |
| `MS_REDIRECT_URI` | for reset email | `https://calendar-post-kevindoyle.vercel.app/api/auth/microsoft/callback` |
| `TOKEN_ENCRYPTION_KEY` | yes for owner login | 32 random bytes, base64 or hex. Generate with `openssl rand -base64 32`. Used to derive the token-encryption and session-signing keys. If you change it, everyone is signed out and the Microsoft sender has to be connected again. |
| `OWNER_EMAIL` | optional | Owner login email. Default `kevin.doyle@adarogroup.eu`. |
| `MS_SENDER_EMAIL` | optional | Mailbox that sends reset emails. Default `OWNER_EMAIL`. |
| `APP_BASE_URL` | optional | Base URL for reset links. Default is the origin of `MS_REDIRECT_URI`. |

Set these for Production in the Vercel project. Preview deployments have different URLs, which
don't match the Entra redirect URI, so connecting Microsoft only works on the production domain.

## Development

```sh
npm install
npm test        # node:test; Graph and Blob are mocked
vercel dev      # optional, needs the env vars above
```
