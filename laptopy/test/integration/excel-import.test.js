import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeXlsx, startServer, TOKENS } from '../support/helpers.js';

const HEADERS = ['Brand', 'Model', 'Price', 'CPU', 'RAM', 'Storage', 'Screen', 'Battery', 'Weight'];
const row = (brand, model, price, extra = {}) => [brand, model, price, extra.cpu ?? 'Intel Core i5', extra.ram ?? '16GB', '512GB SSD', '15.6" FHD', '8h', '1.7kg'];

async function upload(s, cookie, buffer, query = '') {
  const res = await fetch(`${s.base}/api/laptops/import${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', Cookie: cookie },
    body: buffer,
  });
  return { status: res.status, json: await res.json() };
}

describe('Excel import', () => {
  let s, admin, other;
  before(async () => {
    s = await startServer();
    admin = (await s.login(TOKENS.admin)).cookie;
    other = (await s.login(TOKENS.other)).cookie;
  });
  after(() => s.close());

  it('is for the admin only', async () => {
    const file = await makeXlsx(HEADERS, [row('Acer', 'Aspire 5', 21000)]);
    const anon = await fetch(`${s.base}/api/laptops/import`, { method: 'POST', body: file });
    assert.equal(anon.status, 401);
    assert.equal((await upload(s, other, file)).status, 403);
    assert.equal((await s.request('/api/laptops/template.xlsx', { cookie: other })).status, 403);
  });

  it('dry run reports the plan and saves nothing', async () => {
    const file = await makeXlsx(HEADERS, [row('Acer', 'Aspire 5', 21000), row('Lenovo', 'IdeaPad Slim 3', 17000)]);
    const { status, json } = await upload(s, admin, file, '?dryRun=1');
    assert.equal(status, 200);
    assert.equal(json.dryRun, true);
    assert.equal(json.created, 1);
    assert.equal(json.updated, 1);
    assert.equal((await s.request('/api/laptops')).json.laptops.length, 5, 'nothing was saved');
  });

  it('creates new laptops and updates existing ones (matched by brand + model), visible to everyone', async () => {
    const file = await makeXlsx(HEADERS, [row('Acer', 'Aspire 5', 21000), row('lenovo', 'ideapad  slim 3', 17000)]);
    const { json } = await upload(s, admin, file);
    assert.equal(json.created, 1);
    assert.equal(json.updated, 1);

    const list = (await s.request('/api/laptops')).json.laptops; // anonymous visitor
    assert.equal(list.length, 6);
    assert.equal(list.find((l) => l.model === 'IdeaPad Slim 3').price, 17000, 'existing laptop updated');
    assert.equal(list.find((l) => l.model === 'IdeaPad Slim 3').notes, 'Great for study and office work', 'untouched fields are kept');
    const acer = list.find((l) => l.model === 'Aspire 5');
    assert.equal(acer.inStock, true);
    assert.equal(acer.gpu, '');
  });

  it('accepts Arabic headers, Arabic digits, in-stock words and photo links', async () => {
    const headers = ['الماركة', 'الموديل', 'السعر', 'المعالج', 'الرام', 'التخزين', 'الشاشة', 'البطارية', 'الوزن', 'متاح', 'الصور', 'الوصف'];
    const file = await makeXlsx(headers, [
      ['MSI', 'Thin 15', '٣٢٬٥٠٠', 'Core i7', '16GB', '1TB SSD', '15.6"', '6h', '1.9kg', 'لا', 'https://example.com/a.jpg https://example.com/b.jpg', 'لابتوب جيمنج'],
    ]);
    const { json } = await upload(s, admin, file);
    assert.equal(json.created, 1);
    const all = (await s.request('/api/laptops?all=1', { cookie: admin })).json.laptops;
    const msi = all.find((l) => l.brand === 'MSI');
    assert.equal(msi.price, 32500);
    assert.equal(msi.inStock, false);
    assert.deepEqual(msi.images, ['https://example.com/a.jpg', 'https://example.com/b.jpg']);
    assert.equal(msi.description, 'لابتوب جيمنج');
    assert.ok(!(await s.request('/api/laptops')).json.laptops.some((l) => l.brand === 'MSI'), 'hidden from customers');
  });

  it('skips bad and duplicate rows, imports the good ones and says why', async () => {
    const file = await makeXlsx(HEADERS, [
      row('Dell', 'Inspiron 15', 19000),
      row('Dell', 'Broken', -5),
      ['', 'No brand', 100, 'x', 'x', 'x', 'x', 'x', 'x'],
      row('dell', 'inspiron 15', 19000),
    ]);
    const { json } = await upload(s, admin, file);
    assert.equal(json.created, 1);
    assert.equal(json.skipped.length, 3);
    assert.match(json.skipped.map((x) => x.message).join('|'), /Price/);
    assert.match(json.skipped.map((x) => x.message).join('|'), /Duplicate of row/);
    assert.equal(json.sameModelTwice, 0);
    assert.deepEqual(json.skipped.map((x) => x.row).sort(), [3, 4, 5]);
  });

  it('explains missing columns and unreadable files', async () => {
    const noPrice = await makeXlsx(['Brand', 'Model'], [['A', 'B']]);
    const a = await upload(s, admin, noPrice);
    assert.equal(a.status, 400);
    assert.equal(a.json.error.code, 'missing_columns');
    assert.match(a.json.error.message, /CPU/);

    const b = await upload(s, admin, Buffer.from('this is not a spreadsheet\x00\x01'));
    assert.equal(b.status, 400);
    const c = await upload(s, admin, Buffer.alloc(0));
    assert.equal(c.json.error.code, 'no_file');
  });

  it('reads CSV files too', async () => {
    const csv = Buffer.from('Brand,Model,Price,CPU,RAM,Storage,Screen,Battery,Weight\nToshiba,Satellite,15000,i3,8GB,256GB SSD,14",5h,1.5kg\n');
    const { json } = await upload(s, admin, csv);
    assert.equal(json.created, 1);
  });

  it('replace mode also removes laptops that are not in the file', async () => {
    const file = await makeXlsx(HEADERS, [row('Acer', 'Aspire 5', 21000)]);
    const preview = await upload(s, admin, file, '?dryRun=1&replace=1');
    assert.ok(preview.json.removed >= 5);
    assert.ok(preview.json.removedNames.includes('HP Pavilion 15'));
    const before = (await s.request('/api/laptops?all=1', { cookie: admin })).json.laptops.length;
    assert.ok(before > 1, 'dry run did not delete');

    const { json } = await upload(s, admin, file, '?replace=1');
    assert.equal(json.removed, before - 1);
    assert.deepEqual((await s.request('/api/laptops?all=1', { cookie: admin })).json.laptops.map((l) => l.model), ['Aspire 5']);
  });

  it('serves a valid template', async () => {
    const res = await fetch(`${s.base}/api/laptops/template.xlsx`, { headers: { Cookie: admin } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition'), /laptopy-laptops-template\.xlsx/);
    const file = Buffer.from(await res.arrayBuffer());
    // the template can be imported as it is
    const { json } = await upload(s, admin, file, '?dryRun=1');
    assert.equal(json.totalRows, 2);
    assert.equal(json.skipped.length, 0);
  });
});
