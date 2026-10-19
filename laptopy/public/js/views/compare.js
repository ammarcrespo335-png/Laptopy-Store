import { compareLaptops } from '/shared/specs.js';
import { api } from '../api.js';
import { laptopVisual } from '../components/laptopArt.js';
import { onClick } from '../events.js';
import { hooks } from '../hooks.js';
import { ICONS, ROBOT } from '../icons.js';
import { $, esc, money, richText } from '../utils.js';
import { byId, state, store } from '../state.js';

const LABEL_WIDTH = 130;
const COL_MIN = 170;

function verdictHTML({ text, mode }) {
  const badge = mode === 'ai' ? 'AI' : 'Quick summary';
  return `<div class="ah"><span class="av">${ROBOT}</span><b>Robin's verdict</b><span class="badge">${badge}</span></div><div dir="auto">${richText(text)}</div>`;
}

export function comparePage() {
  const list = state.compare.map(byId).filter(Boolean);
  if (list.length < 2) {
    return `<main class="wrap"><div class="sec"><h2>Compare devices</h2></div>
      <p class="mu">Pick at least 2 devices to compare them side by side.</p>
      <div class="actions"><a class="btn primary" href="#shop">Browse devices</a></div></main>`;
  }

  const cur = store().currency;
  const { rows, scores, top } = compareLaptops(list);
  const cols = `${LABEL_WIDTH}px repeat(${list.length}, minmax(${COL_MIN}px, 1fr))`;

  const heads = list
    .map(
      (l, i) => `<div class="ch ${scores[i] === top ? 'top' : ''}" style="--i:${i}">
        <button type="button" class="rm" data-action="toggle-compare" data-id="${esc(l.id)}" aria-label="Remove ${esc(l.brand)} ${esc(l.model)} from comparison">${ICONS.close}</button>
        ${scores[i] === top ? '<span class="bo">Best overall</span>' : ''}
        <div class="ca">${laptopVisual(l)}</div>
        <a class="nmlink" href="#laptop/${encodeURIComponent(l.id)}"><b>${esc(l.brand)} ${esc(l.model)}</b></a>
        <div class="ring" style="--p:${scores[i]}" role="img" aria-label="Overall score ${scores[i]} out of 100"><span>${scores[i]}</span></div>
        <small>Overall score</small>
      </div>`,
    )
    .join('');

  // rows nobody has data for (e.g. battery when comparing two desktops) are left out
  const metricRows = rows
    .filter((row) => !row.empty)
    .map(
      (row, ri) => `<div class="r"><div class="cl">${row.label}<small>${row.hint}</small></div>${row.cells
        .map((cell, i) => {
          if (cell.pct === null) return `<div class="cc" style="--i:${ri}"><div class="cv mu">—</div></div>`;
          const text = row.key === 'price' ? money(list[i].price, cur) : list[i][row.key];
          return `<div class="cc ${cell.best ? 'win' : ''}" style="--i:${ri}">
            <div class="cv">${esc(text)}${cell.best ? ' <span class="sr-only">(best)</span>' : ''}</div>
            <div class="bar"><i style="--w:${cell.pct}%;--d:${(ri * 0.1 + i * 0.08).toFixed(2)}s"></i></div>
          </div>`;
        })
        .join('')}</div>`,
    )
    .join('');

  const textRows = [['type', 'Type'], ['cpu', 'Processor'], ['gpu', 'Graphics'], ['screen', 'Display']]
    .filter(([key]) => list.some((l) => l[key]))
    .map(([key, label], ri) => `<div class="r"><div class="cl">${label}</div>${list
      .map((l) => `<div class="cc" style="--i:${ri + 5}">${l[key] ? esc(l[key]) : '<span class="mu">—</span>'}</div>`)
      .join('')}</div>`)
    .join('');

  const v = state.verdict;
  return `<main class="wrap">
    <div class="sec"><h2>Compare devices</h2><p class="mu">The best value in each row is highlighted. Bars show each laptop relative to the best one.</p></div>
    <div class="tw"><div class="cg" style="grid-template-columns:${cols};min-width:${LABEL_WIDTH + list.length * COL_MIN}px" role="table" aria-label="Laptop comparison">
      <div class="cl"></div>${heads}${metricRows}${textRows}
    </div></div>
    <div class="actions">
      <button type="button" class="btn primary" data-action="compare-ask">${ICONS.spark} Robin's AI comparison</button>
      <button type="button" class="btn" data-action="compare-clear">Clear</button>
    </div>
    <div class="verdict" id="verdict" aria-live="polite" ${v ? '' : 'hidden'}>${v ? verdictHTML(v) : ''}</div>
  </main>`;
}

export function registerCompareHandlers() {
  onClick('compare-clear', () => hooks.setCompare([]));

  onClick('compare-ask', async (button) => {
    const box = $('#verdict');
    button.disabled = true;
    box.hidden = false;
    box.innerHTML = '<span class="dots" role="status" aria-label="Robin is thinking"><i></i><i></i><i></i></span>';
    try {
      state.verdict = await api.compare(state.compare);
      box.innerHTML = verdictHTML(state.verdict);
    } catch (err) {
      box.textContent = err.message || 'Could not get a comparison right now.';
    } finally {
      button.disabled = false;
    }
  });
}
