import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { parseSse, startServer } from '../support/helpers.js';
import { extractBudget, LocalAdvisor } from '../../src/services/local-advisor.service.js';
import { compareLaptops, num, toGB } from '../../shared/specs.js';
import { trimToConversation } from '../../src/services/advisor.service.js';

const stock = [
  { brand: 'Lenovo', model: 'IdeaPad Slim 3', price: 18500, cpu: 'Intel Core i5-12450H', ram: '8GB', storage: '512GB SSD', screen: '15.6" FHD', gpu: 'Integrated', battery: '8h', weight: '1.6kg' },
  { brand: 'ASUS', model: 'TUF Gaming F15', price: 38900, cpu: 'Intel Core i7-12700H', ram: '16GB', storage: '1TB SSD', screen: '15.6" FHD 144Hz', gpu: 'RTX 3050 4GB', battery: '6h', weight: '2.2kg' },
  { brand: 'Apple', model: 'MacBook Air M2', price: 49900, cpu: 'Apple M2', ram: '8GB', storage: '256GB SSD', screen: '13.6" Retina', gpu: '10-core GPU', battery: '15h', weight: '1.24kg' },
  { brand: 'Dell', model: 'XPS 15', price: 78000, cpu: 'Intel Core i7-13700H', ram: '32GB', storage: '1TB SSD', screen: '15.6" OLED 3.5K', gpu: 'RTX 4050 6GB', battery: '10h', weight: '1.86kg' },
];

describe('spec helpers', () => {
  it('parses numbers and storage', () => {
    assert.equal(num('16GB'), 16);
    assert.equal(num('1.6kg'), 1.6);
    assert.ok(Number.isNaN(num('n/a')));
    assert.equal(toGB('1TB SSD'), 1024);
    assert.equal(toGB('512GB SSD'), 512);
  });

  it('scores comparisons (best in each row = 100, lowest price / weight win)', () => {
    const { rows, scores, topIndexes } = compareLaptops(stock.slice(0, 3));
    const price = rows.find((r) => r.key === 'price');
    assert.equal(price.cells[0].best, true);
    assert.equal(price.cells[0].pct, 100);
    assert.equal(rows.find((r) => r.key === 'battery').cells[2].best, true);
    assert.equal(rows.find((r) => r.key === 'weight').cells[2].best, true);
    assert.equal(scores.length, 3);
    assert.ok(topIndexes.length >= 1);
  });

  it('never counts missing data as zero (a desktop has no battery)', () => {
    const desktop = { ...stock[0], battery: '', weight: '' };
    const { rows, scores } = compareLaptops([desktop, stock[1]]);
    assert.equal(rows.find((r) => r.key === 'battery').cells[0].pct, null);
    assert.equal(rows.find((r) => r.key === 'battery').cells[1].best, false, 'one value alone is not "the best"');
    assert.ok(scores[0] > 0);
    const empty = compareLaptops([{ ...stock[0], battery: '', weight: '' }, { ...stock[1], battery: '', weight: '' }]);
    assert.equal(empty.rows.find((r) => r.key === 'battery').empty, true);
  });

  it('survives missing values', () => {
    const { rows } = compareLaptops([{ ...stock[0], battery: 'n/a' }, stock[1]]);
    assert.equal(rows.find((r) => r.key === 'battery').cells[0].pct, null);
  });
});

describe('local advisor', () => {
  const advisor = new LocalAdvisor({ currency: 'EGP' });

  it('reads budgets in Arabic and English forms', () => {
    assert.equal(extractBudget('ميزانيتي 40 ألف'), 40000);
    assert.equal(extractBudget('budget 35,000'), 35000);
    assert.equal(extractBudget('٣٠٠٠٠ جنيه'), 30000);
    assert.equal(extractBudget('i need 16GB ram'), 0);
  });

  it('recommends a dedicated-GPU laptop for gaming', () => {
    const text = advisor.reply('عايز لابتوب جيمنج ميزانيتي 40 ألف', stock);
    assert.match(text, /TUF Gaming F15/);
    assert.ok(!text.includes('XPS 15'), 'must respect the budget');
  });

  it('answers in English when the customer writes English', () => {
    const text = advisor.reply('I want a laptop for programming', stock);
    assert.match(text, /programming/i);
    assert.match(text, /Best matches/);
  });

  it('is honest when nothing fits the budget', () => {
    const text = advisor.reply('gaming laptop under 5000', stock);
    assert.match(text, /Nothing fits/);
  });

  it('explains specs when asked', () => {
    assert.match(advisor.reply('what is ram', stock), /working memory/);
  });

  it('asks for details when the message has none', () => {
    assert.match(advisor.reply('hello', stock), /budget/i);
  });

  it('summarises a comparison', () => {
    const text = advisor.compareSummary(stock.slice(0, 2), { lang: 'en' });
    assert.match(text, /Best overall/);
    assert.match(text, /Lowest price: \*\*Lenovo IdeaPad Slim 3\*\*/);
  });
});

describe('conversation trimming', () => {
  it('starts and ends on a customer turn', () => {
    const out = trimToConversation([
      { role: 'assistant', content: 'a' }, { role: 'user', content: 'b' }, { role: 'assistant', content: 'c' },
      { role: 'user', content: 'd' }, { role: 'assistant', content: 'e' },
    ]);
    assert.deepEqual(out.map((m) => m.content), ['b', 'c', 'd']);
  });
});

describe('chat endpoint', () => {
  it('streams a local answer when no AI provider is configured', async () => {
    const s = await startServer();
    const res = await s.request('/api/chat', { method: 'POST', body: { messages: [{ role: 'user', content: 'عايز لاب للبرمجة' }] } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const events = parseSse(res.text);
    assert.equal(events.at(-1).event, 'done');
    assert.equal(events.at(-1).data.mode, 'local');
    assert.match(events.filter((e) => e.event === 'delta').map((e) => e.data.text).join(''), /برمجة/);
    await s.close();
  });

  it('streams from the AI provider and sends it the live stock', async () => {
    let seen;
    const provider = {
      async streamText({ system, messages, onDelta }) {
        seen = { system, messages };
        onDelta('Hello ');
        onDelta('from Robin');
      },
      async complete() { return 'AI verdict'; },
    };
    const s = await startServer({ provider });
    const res = await s.request('/api/chat', { method: 'POST', body: { messages: [{ role: 'user', content: 'hi' }] } });
    const events = parseSse(res.text);
    assert.deepEqual(events.map((e) => e.event), ['delta', 'delta', 'done']);
    assert.equal(events.at(-1).data.mode, 'ai');
    assert.match(seen.system, /IdeaPad Slim 3/);
    assert.match(seen.system, /Robin/);
    await s.close();
  });

  it('falls back to the local advisor when the provider fails before answering', async () => {
    const provider = { async streamText() { throw new Error('overloaded'); }, async complete() { throw new Error('overloaded'); } };
    const s = await startServer({ provider });
    const res = await s.request('/api/chat', { method: 'POST', body: { messages: [{ role: 'user', content: 'gaming laptop' }] } });
    const events = parseSse(res.text);
    assert.equal(events.at(-1).data.mode, 'local');
    assert.match(events[0].data.text, /TUF Gaming F15/);

    const cmp = await s.request('/api/compare', { method: 'POST', body: { ids: ['s1', 's3'], lang: 'en' } });
    assert.equal(cmp.status, 200);
    assert.equal(cmp.json.mode, 'local');
    await s.close();
  });

  it('validates chat and compare input', async () => {
    const s = await startServer();
    assert.equal((await s.request('/api/chat', { method: 'POST', body: { messages: [] } })).status, 400);
    assert.equal((await s.request('/api/chat', { method: 'POST', body: { messages: [{ role: 'system', content: 'x' }] } })).status, 400);
    assert.equal((await s.request('/api/chat', { method: 'POST', body: { messages: [{ role: 'user', content: 'x'.repeat(4001) }] } })).status, 400);
    assert.equal((await s.request('/api/compare', { method: 'POST', body: { ids: ['s1'] } })).status, 400);
    assert.equal((await s.request('/api/compare', { method: 'POST', body: { ids: ['s1', 'missing'] } })).status, 404);
    await s.close();
  });

  it('rate-limits chat', async () => {
    const s = await startServer({ rateLimits: { multiplier: 1 } });
    let last;
    for (let i = 0; i < 17; i++) {
      last = await s.request('/api/chat', { method: 'POST', body: { messages: [{ role: 'user', content: 'hi there' }] } });
    }
    assert.equal(last.status, 429);
    assert.equal(last.json.error.code, 'rate_limited');
    await s.close();
  });

  it('compares with the AI provider when available', async () => {
    const provider = { async streamText() {}, async complete() { return 'AI verdict' ; } };
    const s = await startServer({ provider });
    const res = await s.request('/api/compare', { method: 'POST', body: { ids: ['s1', 's2'] } });
    assert.deepEqual(res.json, { text: 'AI verdict', mode: 'ai' });
    await s.close();
  });
});
