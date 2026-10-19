import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { JPEG, PNG, startServer, TOKENS } from '../support/helpers.js';

describe('laptop photos', () => {
  let s, admin, other;
  const post = (cookie, id, body, type = 'image/jpeg') =>
    fetch(`${s.base}/api/laptops/${id}/images`, { method: 'POST', headers: { 'Content-Type': type, ...(cookie ? { Cookie: cookie } : {}) }, body });

  before(async () => {
    s = await startServer();
    admin = (await s.login(TOKENS.admin)).cookie;
    other = (await s.login(TOKENS.other)).cookie;
  });
  after(() => s.close());

  it('is for the admin only', async () => {
    assert.equal((await post(null, 's1', JPEG)).status, 401);
    assert.equal((await post(other, 's1', JPEG)).status, 403);
    assert.equal((await s.request('/api/laptops/s1/images/0', { method: 'DELETE', cookie: other })).status, 403);
  });

  it('stores uploaded photos and serves them to everyone', async () => {
    const res = await post(admin, 's1', JPEG);
    assert.equal(res.status, 201);
    const { laptop } = await res.json();
    assert.equal(laptop.images.length, 1);
    assert.match(laptop.images[0], /^\/uploads\/s1-[a-f0-9]+\.jpg$/);

    await post(admin, 's1', PNG, 'image/png');
    const served = await fetch(s.base + laptop.images[0]);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), JPEG);

    const pub = (await s.request('/api/laptops')).json.laptops.find((l) => l.id === 's1');
    assert.equal(pub.images.length, 2);
  });

  it('checks the real file type, not the name or Content-Type', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.equal((await post(admin, 's2', svg, 'image/jpeg')).status, 400);
    assert.equal((await post(admin, 's2', Buffer.from('hello world, not an image'), 'image/png')).status, 400);
    assert.equal((await post(admin, 's2', Buffer.alloc(0))).status, 400);
    assert.equal((await post(admin, 'missing', JPEG)).status, 404);
  });

  it('limits the number of photos per laptop', async () => {
    let status;
    for (let i = 0; i < 11; i++) status = (await post(admin, 's3', JPEG)).status;
    assert.equal(status, 400);
    assert.equal((await s.request('/api/laptops')).json.laptops.find((l) => l.id === 's3').images.length, 10);
  });

  it('removes a photo (and its file)', async () => {
    const { laptop } = await (await post(admin, 's4', JPEG)).json();
    const file = path.join(s.config.uploadsDir, path.basename(laptop.images[0]));
    await fs.access(file);
    const res = await s.request('/api/laptops/s4/images/0', { method: 'DELETE', cookie: admin });
    assert.equal(res.status, 200);
    assert.equal(res.json.laptop.images.length, 0);
    await assert.rejects(fs.access(file));
    assert.equal((await s.request('/api/laptops/s4/images/5', { method: 'DELETE', cookie: admin })).status, 404);
  });

  it('keeps photo links given by the admin and deletes the files of dropped photos', async () => {
    const { laptop } = await (await post(admin, 's5', JPEG)).json();
    const file = path.join(s.config.uploadsDir, path.basename(laptop.images[0]));
    const patch = await s.request('/api/laptops/s5', { method: 'PATCH', cookie: admin, body: { images: ['https://example.com/photo.jpg'] } });
    assert.deepEqual(patch.json.laptop.images, ['https://example.com/photo.jpg']);
    await assert.rejects(fs.access(file));
    const bad = await s.request('/api/laptops/s5', { method: 'PATCH', cookie: admin, body: { images: ['javascript:alert(1)'] } });
    assert.equal(bad.status, 400);
  });

  it('deletes the photos of a deleted laptop', async () => {
    const { laptop } = await (await post(admin, 's2', PNG, 'image/png')).json();
    const file = path.join(s.config.uploadsDir, path.basename(laptop.images[0]));
    await fs.access(file);
    assert.equal((await s.request('/api/laptops/s2', { method: 'DELETE', cookie: admin })).status, 204);
    await assert.rejects(fs.access(file));
  });
});
