import { ICONS } from '../icons.js';
import { esc, money, orderMessage, waLink, $$ } from '../utils.js';
import { state, store } from '../state.js';
import { laptopVisual } from './laptopArt.js';

const DETAIL_ROWS = [
  ['cpu', 'Processor'], ['ram', 'Memory'], ['storage', 'Storage'], ['screen', 'Display'], ['gpu', 'Graphics'],
  ['battery', 'Battery'], ['weight', 'Weight'], ['os', 'Operating system'], ['color', 'Color'], ['warranty', 'Warranty'],
];

/** The four spec tiles: laptops show their display, desktops (no screen) show graphics or the device type instead. */
const keySpecs = (l) => [
  ['cpu', 'Processor'], ['ram', 'Memory'], ['storage', 'Storage'],
  l.screen ? ['screen', 'Display'] : l.gpu ? ['gpu', 'Graphics'] : ['type', 'Type'],
];

const compareLabel = (on) => (on ? `${ICONS.check} Added` : `${ICONS.plus} Compare`);

/** "+ Compare" toggle. `cls` lets other places (chat) reuse it with a smaller look. */
export function compareButtonHTML(id, cls = 'cmpb') {
  const on = state.compare.includes(id);
  return `<button type="button" class="${cls} ${on ? 'on' : ''}" data-action="toggle-compare" data-id="${esc(id)}" aria-pressed="${on}">${compareLabel(on)}</button>`;
}

/** Keeps every compare button for one laptop in sync (cards, chat suggestions, ...). */
export function syncCompareButtons(id) {
  const on = state.compare.includes(id);
  for (const btn of $$(`[data-action="toggle-compare"][data-id="${CSS.escape(id)}"]`)) {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    if (!btn.classList.contains('rm')) btn.innerHTML = compareLabel(on);
  }
}

export function orderLinkHTML(l, cls = 'wab', label = 'Order on WhatsApp') {
  const s = store();
  return `<a class="${cls}" href="${esc(waLink(s.whatsapp, orderMessage(l, s.currency)))}" target="_blank" rel="noopener">${ICONS.wa} ${label}</a>`;
}

/**
 * "View photos": a normal link to pictures of this exact model on the web (opens in a new tab).
 * The link is a Google Images search for the product's exact name, so every result shows that model.
 */
export function photosLinkHTML(l, cls = 'photos', label = 'View photos') {
  return `<a class="${cls}" href="${esc(l.photosUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)} of ${esc(l.brand)} ${esc(l.model)} (opens in a new tab)">${ICONS.photo} ${label}</a>`;
}

export function cardHTML(l, index, { cheapest, many }) {
  const cur = store().currency;
  const tag = many && l.price === cheapest ? '<span class="tag">Best price</span>' : '';
  const kind = l.type && l.type !== 'Laptop' ? `<span class="typ">${esc(l.type)}</span>` : '';
  const details = DETAIL_ROWS.filter(([key]) => l[key]).map(([key, label]) => `<b>${label}</b><span>${esc(l[key])}</span>`).join('');
  return `<article class="card" style="--i:${index}">
    <div class="pic">${laptopVisual(l)}<span class="br">${esc(l.brand)}</span>${kind}${tag}</div>
    <h3 class="nm"><a class="card-link" href="#laptop/${encodeURIComponent(l.id)}" aria-label="${esc(l.brand)} ${esc(l.model)}: full details">${esc(l.model)}</a></h3>
    ${l.notes ? `<p class="mu">${esc(l.notes)}</p>` : '<p class="mu">&nbsp;</p>'}
    <div class="k4">${keySpecs(l).map(([k, label]) => `<div><span>${label}</span>${esc(l[k])}</div>`).join('')}</div>
    <details><summary>Quick specs</summary><div class="sp">${details}</div></details>
    <div class="foot"><div class="price">${money(l.price, cur)}</div>${compareButtonHTML(l.id)}</div>
    <div class="cl2">${orderLinkHTML(l, 'wab', 'Order')}${photosLinkHTML(l, 'photos')}</div>
    <p class="more" aria-hidden="true">View details ${ICONS.next}</p>
  </article>`;
}
