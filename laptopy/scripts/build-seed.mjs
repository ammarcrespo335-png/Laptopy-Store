/**
 * Builds the starting catalogue (seed/laptops.seed.json) from an Excel price list.
 *
 *   node scripts/build-seed.mjs docs/laptopy_price_list.xlsx
 *
 * It uses the same reader as the Admin "Import from Excel" button, so the result is exactly what an import
 * would create. The first start of the website (when data/laptops.json does not exist yet) copies this file.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LaptopImportService } from '../src/services/laptop-import.service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
const output = path.resolve(process.argv[3] ?? path.join(root, 'seed', 'laptops.seed.json'));
if (!input) {
  console.error('Usage: node scripts/build-seed.mjs <price-list.xlsx> [output.json]');
  process.exit(1);
}

const { items, skipped, priceListMode } = await new LaptopImportService({}).toCatalogue(await fs.readFile(input));
const catalogue = items.map((item, i) => ({ id: `p${String(i + 1).padStart(3, '0')}`, ...item }));
await fs.writeFile(output, `${JSON.stringify(catalogue, null, 2)}\n`);

console.log(`${catalogue.length} products written to ${path.relative(root, output)} (${priceListMode ? 'price-list format' : 'template format'})`);
if (skipped.length) {
  console.log(`${skipped.length} rows skipped:`);
  for (const s of skipped) console.log(`  row ${s.row}: ${s.error}`);
}
