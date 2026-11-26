import { config } from './config.js';
import { sendMail } from './graph.js';

const escape = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function resetLink(token) {
  const base = config().baseUrl;
  if (!base) throw Object.assign(new Error('APP_BASE_URL (or MS_REDIRECT_URI) is not set'), { status: 503 });
  // The token goes in the URL fragment so it never reaches server logs or Referer headers.
  return base + '/owner.html#reset=' + encodeURIComponent(token);
}

export async function sendResetEmail(to, token) {
  const link = resetLink(token);
  const html = '<p>Someone asked to reset the owner password for December Post (Calendar Post).</p>'
    + '<p><a href="' + escape(link) + '">Choose a new password</a></p>'
    + '<p>This link works once and expires in 30 minutes. If you did not ask for this, you can ignore this email; your password has not changed.</p>';
  return sendMail({ to, subject: 'Reset your December Post password', html });
}

export function sendTestEmail(to) {
  return sendMail({ to, subject: 'December Post sender test', html: '<p>Password-reset emails for December Post can be sent from this mailbox.</p>' });
}
