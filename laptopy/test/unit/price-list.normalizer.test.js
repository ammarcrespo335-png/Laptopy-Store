import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  normalizeCpu, normalizeGpu, normalizeProductName, normalizeStorage, normalizeType, photosSearchUrl, normalizePriceListRow,
} from '../../src/services/price-list.normalizer.js';
import { laptopCreateSchema } from '../../src/validators/laptop.schema.js';

const name = (raw, opts) => {
  const n = normalizeProductName(raw, opts);
  return n && `${n.brand} ${n.model}`;
};

describe('product names from the price list', () => {
  it('fixes HP names', () => {
    assert.equal(name('hp840 g8'), 'HP EliteBook 840 G8');
    assert.equal(name('HP 650 G9'), 'HP ProBook 650 G9');
    assert.equal(name('hp1040 g7'), 'HP EliteBook 1040 G7');
    assert.equal(name('hp 845g10'), 'HP EliteBook 845 G10');
    assert.equal(name('hp830 G10 2IN1'), 'HP EliteBook 830 G10 2-in-1');
    assert.equal(name('ELITEBOOK 860 G11'), 'HP EliteBook 860 G11');
    assert.equal(name('dragon fly g2'), 'HP Elite Dragonfly G2');
    assert.equal(name('HP x2 1013 G3'), 'HP Elite x2 1013 G3');
  });

  it('uses the names HP really sells for ZBooks (14u G5, Firefly 14 G7/G8)', () => {
    assert.equal(name('HP zbook 14 g5'), 'HP ZBook 14u G5');
    assert.equal(name('hp zbook 14 g7'), 'HP ZBook Firefly 14 G7');
    assert.equal(name('HP zbook 14 g8'), 'HP ZBook Firefly 14 G8');
    assert.equal(name('HP ZBook 15 G5 u'), 'HP ZBook 15u G5');
    assert.equal(name('HP Zbook Fury G8', { display: '15.6' }), 'HP ZBook Fury 15 G8');
    assert.equal(name('HP ZBook 15 G7 Power'), 'HP ZBook Power G7');
    assert.equal(name('zbook studio g5 x360'), 'HP ZBook Studio x360 G5');
    assert.equal(name('hp zbook Studio16g9'), 'HP ZBook Studio 16 G9');
  });

  it('fixes Dell names (Latitude vs Precision, typos, bare numbers)', () => {
    assert.equal(name('dell 5580'), 'Dell Latitude 5580');
    assert.equal(name('7560'), 'Dell Precision 7560');
    assert.equal(name('percision 7720'), 'Dell Precision 7720');
    assert.equal(name('P5510'), 'Dell Precision 5510');
    assert.equal(name('p5550-'), 'Dell Precision 5550');
    assert.equal(name('7320 tablet'), 'Dell Latitude 7320 Detachable');
    assert.equal(name('XPS', { display: '15.6' }), 'Dell XPS 15');
  });

  it('fixes Lenovo, Surface, Razer and desktop names', () => {
    assert.equal(name('Lenovo T460S'), 'Lenovo ThinkPad T460s');
    assert.equal(name('Lenovo L13 Gen1'), 'Lenovo ThinkPad L13 Gen 1');
    assert.equal(name('Lenovo V14 G2'), 'Lenovo V14 G2');
    assert.equal(name('SURFACE LAPTOP 3 15', { display: '15' }), 'Microsoft Surface Laptop 3 15"');
    assert.equal(name('SURFACE LAPTOP 4 14', { display: '13.5' }), 'Microsoft Surface Laptop 4 13.5"');
    assert.equal(name('razer- 14'), 'Razer Blade 14');
    assert.equal(name('HP 600/800 G3', { type: 'Desktop' }), 'HP ProDesk / EliteDesk 600/800 G3');
    assert.equal(name('HP 6305', { type: 'Desktop' }), 'HP Compaq Pro 6305');
    assert.equal(name('Unknown thing'), null);
  });

  it('builds a photo search for the exact product name', () => {
    const url = photosSearchUrl({ brand: 'HP', model: 'EliteBook 840 G8', type: 'Laptop' });
    assert.match(url, /^https:\/\/www\.google\.com\/search\?tbm=isch&q=/);
    assert.equal(decodeURIComponent(url.split('q=')[1]), '"HP EliteBook 840 G8" laptop');
    const pc = photosSearchUrl({ search: 'HP EliteDesk 800 G3', type: 'Tower' });
    assert.equal(decodeURIComponent(pc.split('q=')[1]), '"HP EliteDesk 800 G3" tower pc');
  });
});

describe('specifications from the price list', () => {
  it('cleans CPUs', () => {
    assert.equal(normalizeCpu('i5-8'), 'Core i5 8th Gen');
    assert.equal(normalizeCpu('I 7 12th'), 'Core i7 12th Gen');
    assert.equal(normalizeCpu('i5 11th (G7)'), 'Core i5 11th Gen (G7)');
    assert.equal(normalizeCpu('i5 8th H'), 'Core i5 8th Gen (H)');
    assert.equal(normalizeCpu('i7 11th'), 'Core i7 11th Gen');
    assert.equal(normalizeCpu('rayzen 7'), 'Ryzen 7');
    assert.equal(normalizeCpu('ULTRA 5'), 'Core Ultra 5');
    assert.equal(normalizeCpu('A6'), 'AMD A6');
    assert.equal(normalizeCpu('Xeon/i7-10'), 'Intel Xeon / Core i7 10th Gen');
    assert.equal(normalizeCpu('Something else'), 'Something else');
  });

  it('cleans storage, graphics and type', () => {
    assert.equal(normalizeStorage('256GB'), '256GB SSD');
    assert.equal(normalizeStorage('HDD 500GB'), '500GB HDD');
    assert.equal(normalizeStorage('1TB'), '1TB SSD');
    assert.deepEqual(normalizeGpu('intel'), { gpu: 'Intel Graphics', touch: false });
    assert.deepEqual(normalizeGpu('nvidia 4 g'), { gpu: 'NVIDIA 4GB', touch: false });
    assert.deepEqual(normalizeGpu('rtx 8 gb'), { gpu: 'NVIDIA RTX 8GB', touch: false });
    assert.deepEqual(normalizeGpu('4 gb'), { gpu: '4GB dedicated', touch: false });
    assert.deepEqual(normalizeGpu('touch screen'), { gpu: '', touch: true });
    assert.equal(normalizeType('Desktop'), 'Desktop');
    assert.equal(normalizeType('Tower'), 'Tower');
    assert.equal(normalizeType(undefined), 'Laptop');
  });

  it('turns a whole row into a catalogue entry', () => {
    const row = normalizePriceListRow({ type: 'Laptop', model: 'hp840 g8', cpu: 'i5-11', ram: '16GB', storage: '256GB', gpu: 'intel', screen: '14' });
    assert.deepEqual(
      { brand: row.brand, model: row.model, cpu: row.cpu, storage: row.storage, gpu: row.gpu, screen: row.screen },
      { brand: 'HP', model: 'EliteBook 840 G8', cpu: 'Core i5 11th Gen', storage: '256GB SSD', gpu: 'Intel Graphics', screen: '14"' },
    );
  });
});

describe('the starting catalogue (seed/laptops.seed.json)', () => {
  it('has the 241 products of the price list and every one is valid', async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const seed = JSON.parse(await fs.readFile(path.join(root, 'seed', 'laptops.seed.json'), 'utf8'));
    assert.equal(seed.length, 241);
    assert.equal(seed.filter((l) => l.type === 'Laptop').length, 212);
    assert.equal(seed.filter((l) => l.type === 'Desktop').length, 22);
    assert.equal(seed.filter((l) => l.type === 'Tower').length, 7);
    assert.equal(new Set(seed.map((l) => l.id)).size, 241, 'unique ids');
    for (const l of seed) {
      const result = laptopCreateSchema.safeParse(l);
      assert.ok(result.success, `${l.brand} ${l.model}: ${result.error?.issues[0]?.message}`);
      assert.match(l.photosUrl, /^https:\/\/www\.google\.com\/search\?tbm=isch&q=%22/, `${l.brand} ${l.model} has an exact-name photo search`);
    }
  });
});
