import { askRobin } from '../components/chat.js';
import { cardHTML, compareButtonHTML, orderLinkHTML, photosLinkHTML } from '../components/laptopCard.js';
import { laptopArt } from '../components/laptopArt.js';
import { onClick } from '../events.js';
import { ICONS } from '../icons.js';
import { $, $$, esc, money } from '../utils.js';
import { byId, state, store, visibleLaptops } from '../state.js';

/** Specifications grouped like a shop's product page; empty values are left out. */
const GROUPS = [
  ['Overview', [['type', 'Type']]],
  ['Performance', [['cpu', 'Processor'], ['ram', 'Memory (RAM)'], ['storage', 'Storage'], ['gpu', 'Graphics']]],
  ['Display', [['screen', 'Screen']]],
  ['Battery and design', [['battery', 'Battery life'], ['weight', 'Weight'], ['color', 'Color']]],
  ['Software and connectivity', [['os', 'Operating system'], ['ports', 'Ports']]],
  ['Warranty', [['warranty', 'Warranty']]],
];

export const currentLaptop = () => byId(state.laptopId);

function notFoundHTML() {
  return `<main class="wrap"><div class="sec"><h2>We could not find this device</h2>
    <p class="mu">It may have been removed or is not available any more.</p></div>
    <div class="actions"><a class="btn primary" href="#shop">${ICONS.back} Back to all devices</a></div></main>`;
}

function galleryHTML(l) {
  const name = `${l.brand} ${l.model}`;
  if (!l.images.length) {
    return `<div class="gal"><div class="gal-main plain">${laptopArt(l)}<span class="nophoto">No photos uploaded yet. Tap "View photos" to see pictures of this model.</span></div></div>`;
  }
  const thumbs = l.images.length > 1
    ? `<div class="thumbs" role="list">${l.images.map((src, i) => `<button type="button" role="listitem" class="th" data-action="gallery-select" data-index="${i}" aria-label="Show photo ${i + 1} of ${l.images.length}" ${i === 0 ? 'aria-current="true"' : ''}><img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>`
    : '';
  return `<div class="gal">
    <button type="button" class="gal-main" id="gal-main" data-action="open-lightbox" data-index="0" aria-label="Open photo 1 of ${l.images.length} full screen">
      <img src="${esc(l.images[0])}" alt="${esc(name)}" referrerpolicy="no-referrer" data-fallback="${esc(l.id)}"><span class="zoom">${ICONS.zoom}</span>
    </button>${thumbs}
  </div>`;
}

function specsHTML(l) {
  const groups = GROUPS.map(([title, rows]) => {
    const filled = rows.filter(([key]) => l[key]);
    return filled.length
      ? `<section class="sg2"><h3>${title}</h3><dl>${filled.map(([key, label]) => `<div><dt>${label}</dt><dd>${esc(l[key])}</dd></div>`).join('')}</dl></section>`
      : '';
  }).join('');
  return `<section class="specs" aria-labelledby="specs-title"><h2 id="specs-title">Full specifications</h2><div class="specgrid">${groups}</div></section>`;
}

/** The same model sold with other specs / at other prices (very common with used and refurbished stock). */
function variantsHTML(l) {
  const cur = store().currency;
  const others = visibleLaptops().filter((x) => x.id !== l.id && x.brand === l.brand && x.model === l.model && x.type === l.type);
  if (!others.length) return '';
  return `<section class="variants" aria-labelledby="var-title"><h2 id="var-title">Other versions of the ${esc(l.brand)} ${esc(l.model)}</h2>
    <ul>${others.map((x) => `<li><a href="#laptop/${encodeURIComponent(x.id)}"><span>${esc([x.cpu, x.ram, x.storage, x.gpu].filter(Boolean).join(' · '))}</span><b>${money(x.price, cur)}</b></a></li>`).join('')}</ul></section>`;
}

function similarHTML(l) {
  const all = visibleLaptops();
  const others = all
    .filter((x) => x.id !== l.id && !(x.brand === l.brand && x.model === l.model))
    .sort((a, b) => (b.brand === l.brand) - (a.brand === l.brand) || Math.abs(a.price - l.price) - Math.abs(b.price - l.price))
    .slice(0, 3);
  if (!others.length) return '';
  const ctx = { cheapest: Math.min(...all.map((x) => x.price)), many: all.length > 1 };
  return `<section class="similar" aria-labelledby="sim-title"><h2 id="sim-title">You may also like</h2>
    <div class="grid">${others.map((x, i) => cardHTML(x, i, ctx)).join('')}</div></section>`;
}

export function productPage() {
  const l = currentLaptop();
  if (!l) return notFoundHTML();
  const cur = store().currency;
  const hidden = l.inStock === false;
  return `<main class="wrap product">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#shop">${ICONS.back} All devices</a></nav>
    <article class="pd">
      ${galleryHTML(l)}
      <section class="info" aria-labelledby="pd-title">
        <p class="eyebrow">${esc(l.brand)}${l.type && l.type !== 'Laptop' ? ` · ${esc(l.type)}` : ''}</p>
        <h1 id="pd-title">${esc(l.model)}</h1>
        ${l.notes ? `<p class="lead2">${esc(l.notes)}</p>` : ''}
        <div class="chips">${[l.cpu, l.ram, l.storage, l.screen, l.gpu].filter(Boolean).map((v) => `<span>${esc(v)}</span>`).join('')}</div>
        <div class="pd-price">${money(l.price, cur)}</div>
        <p class="stock ${hidden ? 'off' : ''}">${hidden ? 'Hidden from customers (admin preview)' : 'In stock at our Giza store'}</p>
        <div class="buy">
          ${orderLinkHTML(l, 'btn wa big', 'Order on WhatsApp')}
          ${photosLinkHTML(l, 'btn big photos-btn', 'View photos')}
          ${compareButtonHTML(l.id, 'btn cmpb')}
          <button type="button" class="btn" data-action="ask-about" data-id="${esc(l.id)}">${ICONS.spark} Ask Robin about it</button>
        </div>
        ${l.description ? `<p class="desc" dir="auto">${esc(l.description)}</p>` : ''}
      </section>
    </article>
    ${specsHTML(l)}
    ${variantsHTML(l)}
    ${similarHTML(l)}
  </main>`;
}

// ---------- full-screen photo viewer ----------
let viewer = null; // { images, index, opener }

function drawViewer() {
  const { images, index } = viewer;
  $('#lb').innerHTML = `<div class="lb-bg" data-action="lb-close"></div>
    <button type="button" class="lb-close" data-action="lb-close" aria-label="Close photo viewer">${ICONS.close}</button>
    ${images.length > 1 ? `<button type="button" class="lb-nav prev" data-action="lb-prev" aria-label="Previous photo">${ICONS.back}</button><button type="button" class="lb-nav next" data-action="lb-next" aria-label="Next photo">${ICONS.next}</button>` : ''}
    <figure><img src="${esc(images[index])}" alt="Photo ${index + 1} of ${images.length}" referrerpolicy="no-referrer"><figcaption>${index + 1} / ${images.length}</figcaption></figure>`;
}

export function openViewer(index, opener) {
  const l = currentLaptop();
  if (!l?.images.length) return;
  viewer = { images: l.images, index, opener };
  let el = $('#lb');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lb';
    el.className = 'lb';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Photo viewer');
    document.body.appendChild(el);
  }
  document.body.classList.add('noscroll');
  drawViewer();
  $('.lb-close').focus();
}

export function closeViewer() {
  if (!viewer) return;
  $('#lb')?.remove();
  document.body.classList.remove('noscroll');
  viewer.opener?.focus?.();
  viewer = null;
}

const step = (delta) => {
  if (!viewer) return;
  viewer.index = (viewer.index + delta + viewer.images.length) % viewer.images.length;
  drawViewer();
  $('.lb-nav.next, .lb-close')?.focus?.();
};

export function registerProductHandlers() {
  onClick('gallery-select', (thumb) => {
    const l = currentLaptop();
    const index = Number(thumb.dataset.index);
    const main = $('#gal-main');
    main.querySelector('img').src = l.images[index];
    main.dataset.index = String(index);
    main.setAttribute('aria-label', `Open photo ${index + 1} of ${l.images.length} full screen`);
    for (const t of $$('.thumbs .th')) t.toggleAttribute('aria-current', t === thumb);
  });
  onClick('open-lightbox', (btn) => openViewer(Number(btn.dataset.index), btn));
  onClick('lb-close', closeViewer);
  onClick('lb-prev', () => step(-1));
  onClick('lb-next', () => step(1));
  onClick('ask-about', (btn) => {
    const l = byId(btn.dataset.id);
    askRobin(`عايز أعرف أكتر عن ${l.brand} ${l.model}، هل يناسبني؟`);
  });

  document.addEventListener('keydown', (e) => {
    if (!viewer) return;
    if (e.key === 'Escape') { e.stopPropagation(); closeViewer(); }
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  }, true);
}

