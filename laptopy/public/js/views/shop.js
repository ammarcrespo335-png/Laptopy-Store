import { cardHTML } from '../components/laptopCard.js';
import { applySliderInput, priceRange, priceSliderHTML } from '../components/priceSlider.js';
import { onChange, onClick, onInput } from '../events.js';
import { hooks } from '../hooks.js';
import { ROBOT } from '../icons.js';
import { $, $$, debounce, esc } from '../utils.js';
import { state, store, visibleLaptops } from '../state.js';
import { heroHTML } from './hero.js';
import { visitHTML } from './visit.js';

const PAGE = 24;
const EMPTY_FILTERS = () => ({ q: '', type: '', brand: '', sort: '', min: null, max: null });
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const TYPE_LABELS = { Laptop: 'Laptops', Desktop: 'Desktops', Tower: 'Towers' };

/** The devices that match the current search, type, brand and price range. */
export function filteredLaptops() {
  const { q, type, brand, sort } = state.filters;
  const [min, max] = priceRange();
  const needle = q.trim().toLowerCase();
  const list = visibleLaptops().filter(
    (l) =>
      (!needle || `${l.brand} ${l.model} ${l.cpu} ${l.ram} ${l.storage} ${l.gpu} ${l.type}`.toLowerCase().includes(needle)) &&
      (!type || l.type === type) &&
      (!brand || l.brand === brand) &&
      l.price >= min &&
      l.price <= max,
  );
  if (sort) list.sort((a, b) => (a.price - b.price) * (sort === 'asc' ? 1 : -1));
  return list;
}

const countText = (list) => `${list.length} device${list.length === 1 ? '' : 's'} · prices in ${store().currency}`;

function cardsHTML(list, from, to) {
  const all = visibleLaptops();
  const ctx = { cheapest: Math.min(...all.map((l) => l.price)), many: all.length > 1 };
  return list.slice(from, to).map((l, i) => cardHTML(l, i, ctx)).join('');
}

function moreBarHTML(list) {
  const shown = Math.min(state.shown, list.length);
  if (list.length <= PAGE) return '';
  return `<span class="mu">Showing ${shown} of ${list.length}</span>${shown < list.length ? `<button type="button" class="btn" data-action="show-more">Show ${Math.min(PAGE, list.length - shown)} more</button>` : ''}`;
}

function emptyHTML() {
  return `<div class="empty"><p>No devices match your filters.</p><button type="button" class="btn" data-action="reset-filters">Reset filters</button></div>`;
}

/** Re-draws only the grid and the counter (filters stay untouched, so typing and dragging stay smooth). */
export function updateGrid({ animate = false } = {}) {
  state.shown = PAGE;
  const list = filteredLaptops();
  const box = $('#gbox');
  if (!box) return;
  box.innerHTML = list.length ? cardsHTML(list, 0, state.shown) : emptyHTML();
  $('#more').innerHTML = moreBarHTML(list);
  $('#cnt').textContent = countText(list);
  if (animate && !reducedMotion()) {
    box.classList.remove('pg');
    void box.offsetWidth; // restart the entrance animation
    box.classList.add('pg');
    setTimeout(() => box.classList.remove('pg'), 1500);
  }
}

function pills(items, current, action, dataKey) {
  return items
    .map(([value, label]) => {
      const on = current === value;
      return `<button type="button" class="${on ? 'on' : ''}" data-action="${action}" data-${dataKey}="${esc(value)}" aria-pressed="${on}">${esc(label)}</button>`;
    })
    .join('');
}

function typePillsHTML() {
  const all = visibleLaptops();
  const present = ['Laptop', 'Desktop', 'Tower'].filter((t) => all.some((l) => l.type === t));
  if (present.length < 2) return '';
  return `<h4>Type</h4><div class="pills" id="types">${pills([['', `All types (${all.length})`], ...present.map((t) => [t, `${TYPE_LABELS[t]} (${all.filter((l) => l.type === t).length})`])], state.filters.type, 'filter-type', 'type')}</div>`;
}

function brandPillsHTML() {
  const all = visibleLaptops();
  const brands = [...new Set(all.map((l) => l.brand))].sort();
  return pills([['', 'All brands'], ...brands.map((b) => [b, `${b} (${all.filter((l) => l.brand === b).length})`])], state.filters.brand, 'filter-brand', 'brand');
}

function marqueeHTML() {
  const brands = [...new Set(visibleLaptops().map((l) => l.brand))];
  if (!brands.length) return '';
  const items = Array(8).fill(brands).flat().map((b) => `<span>${esc(b)}</span><i>◆</i>`).join('');
  return `<div class="mq" aria-hidden="true"><div>${items}</div></div>`;
}

export function shopPage() {
  state.shown = PAGE;
  const list = filteredLaptops();
  const s = state.filters.sort;
  return `${heroHTML()}
  <main class="wrap" id="catalogue">
    ${marqueeHTML()}
    <div class="sh"><h2>Our devices</h2><p class="mu">Laptops, desktops and towers with full specs and clear prices. Compare models side by side, or ask Robin to pick for you.</p></div>
    <div class="shopw">
      <aside class="side" aria-label="Filters">
        <h4><label for="search">Search</label></h4>
        <input id="search" type="search" placeholder="Model, processor, RAM…" value="${esc(state.filters.q)}" data-input="search" autocomplete="off">
        <h4><label for="sort">Sort by</label></h4>
        <select id="sort" data-change="sort">
          <option value="">Featured</option>
          <option value="asc" ${s === 'asc' ? 'selected' : ''}>Price: low to high</option>
          <option value="desc" ${s === 'desc' ? 'selected' : ''}>Price: high to low</option>
        </select>
        ${typePillsHTML()}
        <h4>Brand</h4>
        <div class="pills" id="brands">${brandPillsHTML()}</div>
        <h4>Price range</h4>
        ${priceSliderHTML()}
        <button type="button" class="rs" data-action="reset-filters">Reset filters</button>
      </aside>
      <section aria-label="Devices">
        <p class="cnt" id="cnt" role="status">${countText(list)}</p>
        <div class="grid" id="gbox">${list.length ? cardsHTML(list, 0, state.shown) : emptyHTML()}</div>
        <div class="morebar" id="more">${moreBarHTML(list)}</div>
      </section>
    </div>
    <section class="steps" aria-labelledby="how-title">
      <h2 id="how-title">How it works</h2>
      <div class="sg">
        <div><em>1</em><b>Tell Robin what you need</b><span>Your budget, usage and preferences, in Arabic or English.</span></div>
        <div><em>2</em><b>Get matched</b><span>Robin recommends from our real stock and compares models for you.</span></div>
        <div><em>3</em><b>Order on WhatsApp</b><span>One tap sends your chosen device to our team.</span></div>
      </div>
    </section>
    ${visitHTML()}
    <section class="nova">
      <div class="orb" aria-hidden="true">${ROBOT}</div>
      <div><h3>Not sure which one to pick?</h3><p>Robin, our AI expert, will ask about your budget and needs, then recommend the best match from our stock.</p></div>
      <button type="button" class="btn" data-action="open-chat">Chat with Robin</button>
    </section>
  </main>`;
}

function syncPills(containerId, attr, value) {
  for (const pill of $$(`#${containerId} button`)) {
    const on = pill.dataset[attr] === value;
    pill.classList.toggle('on', on);
    pill.setAttribute('aria-pressed', String(on));
  }
}

export function registerShopHandlers() {
  onInput('search', debounce((el) => {
    state.filters.q = el.value;
    updateGrid();
  }, 120));

  onInput('price', (el) => {
    applySliderInput(el);
    updateGrid();
  });

  onChange('sort', (el) => {
    state.filters.sort = el.value;
    updateGrid({ animate: true });
  });

  onClick('filter-type', (el) => {
    state.filters.type = el.dataset.type;
    syncPills('types', 'type', state.filters.type);
    updateGrid({ animate: true });
  });

  onClick('filter-brand', (el) => {
    state.filters.brand = el.dataset.brand;
    syncPills('brands', 'brand', state.filters.brand);
    updateGrid({ animate: true });
  });

  onClick('show-more', () => {
    const list = filteredLaptops();
    const from = state.shown;
    state.shown = Math.min(list.length, state.shown + PAGE);
    $('#gbox').insertAdjacentHTML('beforeend', cardsHTML(list, from, state.shown).replaceAll(/--i:\d+/g, '--i:0'));
    $('#more').innerHTML = moreBarHTML(list);
  });

  onClick('reset-filters', () => {
    state.filters = EMPTY_FILTERS();
    hooks.renderPage({ animate: false });
  });

  onClick('scroll-shop', () => {
    $('#catalogue')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
}
