import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startServer, TOKENS, validLaptop } from '../support/helpers.js';

describe('laptops API', () => {
  let s, admin, other;
  before(async () => {
    s = await startServer();
    admin = (await s.login(TOKENS.admin)).cookie;
    other = (await s.login(TOKENS.other)).cookie;
  });
  after(() => s.close());

  it('lists the seeded catalogue publicly', async () => {
    const res = await s.request('/api/laptops');
    assert.equal(res.status, 200);
    assert.equal(res.json.laptops.length, 5);
    assert.ok(!('createdAt' in res.json.laptops[0]));
  });

  it('blocks anonymous visitors from every write', async () => {
    const create = await s.request('/api/laptops', { method: 'POST', body: validLaptop });
    const patch = await s.request('/api/laptops/s1', { method: 'PATCH', body: { price: 1 } });
    const del = await s.request('/api/laptops/s1', { method: 'DELETE' });
    assert.deepEqual([create.status, patch.status, del.status], [401, 401, 401]);
  });

  it('blocks a signed-in non-admin account from every write', async () => {
    const create = await s.request('/api/laptops', { method: 'POST', body: validLaptop, cookie: other });
    const patch = await s.request('/api/laptops/s1', { method: 'PATCH', body: { price: 1 }, cookie: other });
    const del = await s.request('/api/laptops/s1', { method: 'DELETE', cookie: other });
    assert.deepEqual([create.status, patch.status, del.status], [403, 403, 403]);
    const list = await s.request('/api/laptops');
    assert.equal(list.json.laptops.find((l) => l.id === 's1').price, 18500);
  });

  it('does not let non-admins see hidden items through ?all=1', async () => {
    await s.request('/api/laptops/s5', { method: 'PATCH', body: { inStock: false }, cookie: admin });
    const asOther = await s.request('/api/laptops?all=1', { cookie: other });
    const asAnon = await s.request('/api/laptops?all=1');
    const asAdmin = await s.request('/api/laptops?all=1', { cookie: admin });
    assert.equal(asOther.json.laptops.length, 4);
    assert.equal(asAnon.json.laptops.length, 4);
    assert.equal(asAdmin.json.laptops.length, 5);
    assert.equal((await s.request('/api/laptops/s5')).status, 404);
    await s.request('/api/laptops/s5', { method: 'PATCH', body: { inStock: true }, cookie: admin });
  });

  it('lets the admin add a laptop (defaults applied, unknown fields dropped)', async () => {
    const res = await s.request('/api/laptops', { method: 'POST', cookie: admin, body: { ...validLaptop, price: '21000', id: 'hacked', isAdmin: true } });
    assert.equal(res.status, 201);
    const l = res.json.laptop;
    assert.notEqual(l.id, 'hacked');
    assert.equal(l.price, 21000);
    assert.equal(l.gpu, '');
    assert.equal(l.type, 'Laptop');
    assert.match(l.photosUrl, /^https:\/\/www\.google\.com\/search\?tbm=isch&q=/);
    assert.equal(l.inStock, true);
    assert.ok(!('isAdmin' in l));
    const list = await s.request('/api/laptops');
    assert.ok(list.json.laptops.some((x) => x.id === l.id));
  });

  it('validates input', async () => {
    const bad = await s.request('/api/laptops', { method: 'POST', cookie: admin, body: { ...validLaptop, price: -5, brand: '' } });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error.code, 'validation_failed');
    const fields = bad.json.error.fields.map((f) => f.field).sort();
    assert.deepEqual(fields, ['brand', 'price']);

    const http = await s.request('/api/laptops', { method: 'POST', cookie: admin, body: { ...validLaptop, images: ['http://insecure.example/x.png'] } });
    assert.equal(http.status, 400);
    const empty = await s.request('/api/laptops/s1', { method: 'PATCH', cookie: admin, body: {} });
    assert.equal(empty.status, 400);
  });

  it('lets the admin change a price and delete a laptop', async () => {
    const patched = await s.request('/api/laptops/s1', { method: 'PATCH', cookie: admin, body: { price: 17999 } });
    assert.equal(patched.status, 200);
    assert.equal(patched.json.laptop.price, 17999);
    assert.equal(patched.json.laptop.brand, 'Lenovo');

    assert.equal((await s.request('/api/laptops/s2', { method: 'DELETE', cookie: admin })).status, 204);
    assert.equal((await s.request('/api/laptops/s2', { method: 'DELETE', cookie: admin })).status, 404);
    assert.equal((await s.request('/api/laptops/nope', { method: 'PATCH', cookie: admin, body: { price: 5 } })).status, 404);
  });

  it('answers unknown API routes and bad JSON with JSON errors', async () => {
    assert.equal((await s.request('/api/does-not-exist')).json.error.code, 'not_found');
    const res = await fetch(`${s.base}/api/laptops`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: admin }, body: '{bad' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'bad_json');
  });
});

describe('persistence', () => {
  it('survives a restart and handles concurrent writes', async () => {
    const s1 = await startServer();
    const admin = (await s1.login(TOKENS.admin)).cookie;
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        s1.request('/api/laptops', { method: 'POST', cookie: admin, body: { ...validLaptop, model: `Concurrent ${i}` } }),
      ),
    );
    const before = (await s1.request('/api/laptops')).json.laptops;
    assert.equal(before.length, 13);
    const dataDir = s1.config.dataDir;
    await s1.close();

    const s2 = await startServer({ env: { DATA_DIR: dataDir } });
    const after = (await s2.request('/api/laptops')).json.laptops;
    assert.equal(after.length, 13);
    await s2.close();
  });
});
