import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { after, before, describe, it } from 'node:test';
import { EMPTY_SEED, PRICE_LIST, startServer, TOKENS } from '../support/helpers.js';

describe('importing the owner price list (the real Excel file)', () => {
  let s, admin, file;
  const upload = async (query = '') => {
    const res = await fetch(`${s.base}/api/laptops/import${query}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', Cookie: admin }, body: file });
    return { status: res.status, json: await res.json() };
  };

  before(async () => {
    s = await startServer({ env: { SEED_FILE: EMPTY_SEED } });
    admin = (await s.login(TOKENS.admin)).cookie;
    file = await fs.readFile(PRICE_LIST);
  });
  after(() => s.close());

  it('reads all 241 rows in the price-list format without skipping any', async () => {
    const { status, json } = await upload('?dryRun=1');
    assert.equal(status, 200);
    assert.equal(json.priceListFormat, true);
    assert.equal(json.totalRows, 241);
    assert.equal(json.created, 241);
    assert.deepEqual(json.skipped, []);
    assert.equal(json.sameModelTwice, 10, 'same model + specs listed twice with different prices: both kept');
    assert.equal((await s.request('/api/laptops')).json.laptops.length, 0, 'a dry run saves nothing');
  });

  it('imports everything with clean names, types and photo links; then a second import changes nothing', async () => {
    const first = await upload();
    assert.equal(first.json.created, 241);

    const list = (await s.request('/api/laptops')).json.laptops;
    assert.equal(list.length, 241);
    const byType = (t) => list.filter((l) => l.type === t).length;
    assert.deepEqual([byType('Laptop'), byType('Desktop'), byType('Tower')], [212, 22, 7]);

    const g8 = list.find((l) => l.brand === 'HP' && l.model === 'EliteBook 840 G8');
    assert.ok(g8, 'hp840 g8 became "HP EliteBook 840 G8"');
    assert.match(g8.cpu, /^Core i\d \d+th Gen/);
    assert.match(g8.storage, /\d+(GB|TB) SSD$/);
    assert.equal(decodeURIComponent(g8.photosUrl.split('q=')[1]), '"HP EliteBook 840 G8" laptop');

    const razer = list.find((l) => l.brand === 'Razer' && l.model === 'Blade 14');
    assert.equal(decodeURIComponent(razer.photosUrl.split('q=')[1]), '"Razer Blade 14" laptop');

    const desktop = list.find((l) => l.type === 'Desktop' && l.model.includes('Compaq Pro 6305'));
    assert.equal(desktop.screen, '');
    assert.equal(desktop.battery, '');
    assert.match(decodeURIComponent(desktop.photosUrl.split('q=')[1]), /desktop$/);

    assert.ok(list.every((l) => l.photosUrl.startsWith('https://www.google.com/search?tbm=isch&q=%22')), 'every product has an exact-name photo search');

    const again = await upload();
    assert.deepEqual([again.json.created, again.json.updated, again.json.unchanged], [0, 0, 241]);
  });

  it('a changed price in the sheet updates that product only', async () => {
    const list = (await s.request('/api/laptops?all=1', { cookie: admin })).json.laptops;
    const target = list.find((l) => l.brand === 'Dell' && l.model === 'Precision 7560');
    const original = target.price;
    const patched = await s.request(`/api/laptops/${target.id}`, { method: 'PATCH', cookie: admin, body: { price: 1 } });
    assert.equal(patched.json.laptop.price, 1);
    const { json } = await upload();
    assert.equal(json.updated, 1);
    assert.equal(json.unchanged, 240);
    const after = (await s.request('/api/laptops')).json.laptops.find((l) => l.id === target.id);
    assert.equal(after.price, original, 'the sheet price is restored');
  });
});
