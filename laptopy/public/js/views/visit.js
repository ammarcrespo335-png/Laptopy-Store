import { ICONS } from '../icons.js';
import { socialLinks } from '../components/social.js';
import { esc, mapLink, waLink } from '../utils.js';
import { store } from '../state.js';

export function visitHTML() {
  const s = store();
  return `<section class="visit" aria-labelledby="visit-title">
    <div>
      <h2 id="visit-title">Visit our store</h2>
      <p class="adr2" dir="rtl" lang="ar">${esc(s.address)}</p>
      <div class="vb">
        <a class="btn primary" href="${esc(mapLink(s.address))}" target="_blank" rel="noopener">${ICONS.pin} Get directions</a>
        <a class="btn" href="${esc(waLink(s.whatsapp))}" target="_blank" rel="noopener">${ICONS.wa} WhatsApp</a>
        <a class="btn" href="tel:+${esc(s.whatsapp)}">${ICONS.phone} ${esc(s.phone)}</a>
      </div>
      <div class="soc">${socialLinks(['ig', 'tt', 'fb'])}</div>
    </div>
    <a class="vmap" href="${esc(mapLink(s.address))}" target="_blank" rel="noopener" aria-label="Open the store location in Google Maps">
      <span class="pin">${ICONS.pin}</span><em>Open in Google Maps</em>
    </a>
  </section>`;
}
