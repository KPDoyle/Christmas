import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { fakeReq, fakeRes } from './helpers.js';
import { setStore, memoryStore } from '../lib/owner/store.js';
import calendar from '../api/calendar.js';
import recipients from '../api/recipients.js';

setStore(memoryStore());
const key = process.env.CALENDAR_KEY;
const bearer = t => ({ authorization: 'Bearer ' + t });

test('public calendar summary is unchanged for visitors and preview links', async () => {
  let res = fakeRes();
  await calendar(fakeReq({ headers: bearer('') }), res);
  assert.deepEqual(res.body, { unlocked: 25, preview: false });
  const previewKey = createHmac('sha256', key).update('2026-preview').digest('base64url');
  res = fakeRes();
  await calendar(fakeReq({ headers: bearer(previewKey) }), res);
  assert.deepEqual(res.body, { unlocked: 25, preview: true });
});

test('festive card still works for guest links', async () => {
  const guest = createHmac('sha256', key).update('guest').digest('base64url');
  const res = fakeRes();
  await calendar(fakeReq({ query: { day: '3', card: '1', topic: 'festive' }, headers: bearer(guest) }), res);
  assert.equal(res.body.topic, 'Christmas');
});

test('admin-only actions still refuse non-admins, including a bare "session" token', async () => {
  for (const token of ['', 'session', 'wrong']) {
    const res = fakeRes();
    await calendar(fakeReq({ method: 'PUT', body: { topic: 'kitchen' }, headers: bearer(token) }), res);
    assert.equal(res.statusCode, 403);
  }
});

test('recipient API refuses forged invite links and "session" without a cookie', async () => {
  for (const token of ['session', 'a'.repeat(32) + '.bad']) {
    const res = fakeRes();
    await recipients(fakeReq({ headers: bearer(token) }), res);
    assert.equal(res.statusCode, 403);
  }
});
