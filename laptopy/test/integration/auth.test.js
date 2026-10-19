import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startServer, TOKENS } from '../support/helpers.js';

describe('authentication', () => {
  let s;
  before(async () => { s = await startServer(); });
  after(() => s.close());

  it('starts signed out', async () => {
    const res = await s.request('/api/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.json.user, null);
  });

  it('rejects an invalid Google token', async () => {
    const { res, cookie } = await s.login('this-is-not-a-valid-token-xx');
    assert.equal(res.status, 401);
    assert.equal(cookie, null);
  });

  it('rejects an unverified e-mail even if it matches the admin', async () => {
    const { res, cookie } = await s.login(TOKENS.unverified);
    assert.equal(res.status, 403);
    assert.equal(cookie, null);
  });

  it('marks the admin e-mail as admin (case-insensitive)', async () => {
    const { res, cookie } = await s.login(TOKENS.admin);
    assert.equal(res.status, 200);
    assert.equal(res.json.user.isAdmin, true);
    const me = await s.request('/api/auth/me', { cookie });
    assert.equal(me.json.user.isAdmin, true);
  });

  it('signs in another account without admin rights', async () => {
    const { res, cookie } = await s.login(TOKENS.other);
    assert.equal(res.json.user.isAdmin, false);
    const me = await s.request('/api/auth/me', { cookie });
    assert.equal(me.json.user.email, 'someone@example.com');
    assert.equal(me.json.user.isAdmin, false);
  });

  it('ignores a tampered session cookie', async () => {
    const { cookie } = await s.login(TOKENS.admin);
    const forged = cookie.slice(0, -4) + 'AAAA';
    const me = await s.request('/api/auth/me', { cookie: forged });
    assert.equal(me.json.user, null);
  });

  it('logs out', async () => {
    const res = await s.request('/api/auth/logout', { method: 'POST' });
    assert.equal(res.status, 204);
    assert.match(res.headers.getSetCookie().join(';'), /laptopy_session=;/);
  });

  it('keeps dev-login disabled unless DEV_AUTH=true', async () => {
    const res = await s.request('/api/auth/dev-login', { method: 'POST', body: { email: 'ramezmilab@gmail.com' } });
    assert.equal(res.status, 404);
  });

  it('does not leak the admin e-mail through /api/config', async () => {
    const res = await s.request('/api/config');
    assert.equal(res.status, 200);
    assert.ok(!res.text.toLowerCase().includes('ramezmilab'));
    assert.equal(res.json.store.name, 'Laptopy');
  });

  it('blocks cross-origin state-changing requests', async () => {
    const { cookie } = await s.login(TOKENS.admin);
    const res = await s.request('/api/auth/logout', { method: 'POST', cookie, headers: { Origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
  });
});

describe('dev login (local testing only)', () => {
  let s;
  before(async () => { s = await startServer({ env: { DEV_AUTH: 'true' } }); });
  after(() => s.close());

  it('works only when explicitly enabled', async () => {
    const res = await s.request('/api/auth/dev-login', { method: 'POST', body: { email: 'ramezmilab@gmail.com' } });
    assert.equal(res.status, 200);
    assert.equal(res.json.user.isAdmin, true);
  });
});

describe('config safety', () => {
  it('refuses DEV_AUTH in production', async () => {
    const { loadConfig } = await import('../../src/config/index.js');
    assert.throws(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'y'.repeat(40), DEV_AUTH: 'true' }), /DEV_AUTH/);
  });
  it('requires SESSION_SECRET in production', async () => {
    const { loadConfig } = await import('../../src/config/index.js');
    assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /SESSION_SECRET/);
  });
});
