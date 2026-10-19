import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

async function waitFor(url, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`${url} did not come up`);
}

describe('real server entry point (node server.js)', () => {
  it('starts, serves the site and the API, and shuts down cleanly', async () => {
    const port = await freePort();
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'laptopy-boot-'));
    const child = spawn(process.execPath, ['server.js'], {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DATA_DIR: dataDir, GOOGLE_CLIENT_ID: '', ANTHROPIC_API_KEY: '', DEV_AUTH: 'false' },
      stdio: 'ignore',
    });
    try {
      const base = `http://127.0.0.1:${port}`;
      assert.equal((await waitFor(`${base}/healthz`)).status, 200);

      const html = await (await fetch(base)).text();
      assert.match(html, /<title>Laptopy/);

      const csp = (await fetch(base)).headers.get('content-security-policy');
      assert.match(csp, /script-src 'self' https:\/\/accounts\.google\.com\/gsi\/client/);
      assert.ok(!/unsafe-eval|script-src[^;]*unsafe-inline/.test(csp), 'scripts must not allow inline/eval');

      const laptops = await (await fetch(`${base}/api/laptops`)).json();
      assert.equal(laptops.laptops.length, 241, 'the real starting catalogue (from the owner\'s price list) is served');

      // front-end modules and the shared specs file are served with the right type
      const spec = await fetch(`${base}/shared/specs.js`);
      assert.match(spec.headers.get('content-type'), /javascript/);
      assert.equal((await fetch(`${base}/js/main.js`)).status, 200);

      // the 3D laptop bundle and its still-picture fallback
      const scene = await fetch(`${base}/vendor/laptop-scene.js`);
      assert.equal(scene.status, 200);
      assert.match(scene.headers.get('content-type'), /javascript/);
      assert.equal((await fetch(`${base}/assets/laptop-poster.webp`)).status, 200);
    } finally {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    }
  });
});
