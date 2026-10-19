import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
/** The tests start from five small sample laptops (not from the real catalogue in seed/). */
export const SAMPLE_SEED = path.resolve(here, '..', 'fixtures', 'sample-laptops.json');
export const EMPTY_SEED = path.resolve(here, '..', 'fixtures', 'empty-catalogue.json');
export const PRICE_LIST = path.resolve(here, '..', 'fixtures', 'laptopy_price_list.xlsx');

export const TOKENS = {
  admin: 'admin-credential-token-000000',
  other: 'other-credential-token-000000',
  unverified: 'unverified-credential-token-0',
};

const IDENTITIES = {
  [TOKENS.admin]: { sub: 'g1', email: 'RamezMilab@Gmail.com', emailVerified: true, name: 'Ramez', picture: '' },
  [TOKENS.other]: { sub: 'g2', email: 'someone@example.com', emailVerified: true, name: 'Someone', picture: '' },
  [TOKENS.unverified]: { sub: 'g3', email: 'ramezmilab@gmail.com', emailVerified: false, name: 'Fake', picture: '' },
};

/** Boots the real app on a random port with fake Google + (optional) fake AI provider. */
export async function startServer({ provider = null, env = {}, rateLimits = { multiplier: 1000 } } = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'laptopy-test-'));
  const config = loadConfig({
    NODE_ENV: 'test',
    SESSION_SECRET: 'x'.repeat(40),
    GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
    DATA_DIR: dataDir,
    SEED_FILE: SAMPLE_SEED,
    ...env,
  });
  const googleVerifier = {
    async verify(token) {
      const identity = IDENTITIES[token];
      if (!identity) throw new Error('invalid token');
      return identity;
    },
  };
  const { app } = await createApp({ config, overrides: { provider, googleAuth: googleVerifier, rateLimits } });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(url, { method = 'GET', body, cookie, headers = {} } = {}) {
    const res = await fetch(base + url, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON (e.g. SSE) */ }
    return { status: res.status, headers: res.headers, text, json };
  }

  /** Signs in through the real /api/auth/google route and returns the session cookie. */
  async function login(token) {
    const res = await request('/api/auth/google', { method: 'POST', body: { credential: token } });
    const set = res.headers.getSetCookie().find((c) => c.startsWith('laptopy_session='));
    return { res, cookie: set ? set.split(';')[0] : null };
  }

  return {
    base, request, login, config,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Parses a Server-Sent-Events body into [{event, data}]. */
export function parseSse(text) {
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const data = JSON.parse(/^data: (.+)$/m.exec(block)?.[1] ?? 'null');
      return { event, data };
    });
}

export const validLaptop = {
  brand: 'Acer', model: 'Aspire 5', price: 21000, cpu: 'Intel Core i5-1235U', ram: '16GB',
  storage: '512GB SSD', screen: '15.6" FHD', battery: '8h', weight: '1.7kg',
};

/** Builds an .xlsx file in memory: headers + rows (arrays). */
export async function makeXlsx(headers, rows) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Smallest byte sequences our upload check recognises. */
export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]);
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 2)]);
