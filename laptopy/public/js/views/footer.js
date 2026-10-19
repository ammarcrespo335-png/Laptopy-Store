import { MARK } from '../icons.js';
import { socialLinks } from '../components/social.js';
import { ICONS } from '../icons.js';
import { esc, mapLink, waLink } from '../utils.js';
import { store } from '../state.js';

export function footerHTML() {
  const s = store();
  return `<div class="fc">
      <div>
        <div class="fbrand">${MARK}<span>${esc(s.name)}</span></div>
        <p class="slg" dir="rtl" lang="ar">${esc(s.slogan)}</p>
        <div class="soc">${socialLinks(['ig', 'tt', 'fb', 'wa'])}</div>
      </div>
      <div>
        <b>Explore</b>
        <a href="#shop">Laptops</a>
        <a href="#compare">Compare</a>
        <button type="button" class="linkbtn" data-action="open-chat">Chat with Robin</button>
      </div>
      <div>
        <b>Contact</b>
        <a href="${esc(waLink(s.whatsapp))}" target="_blank" rel="noopener">WhatsApp: ${esc(s.phone)}</a>
        <a href="tel:+${esc(s.whatsapp)}">Call: ${esc(s.phone)}</a>
        <a class="adr" dir="rtl" lang="ar" href="${esc(mapLink(s.address))}" target="_blank" rel="noopener">${ICONS.pin} ${esc(s.address)}</a>
        <span class="line">Prices in ${esc(s.currency)}</span>
      </div>
    </div>
    <div class="cp">© ${new Date().getFullYear()} ${esc(s.name)}. All rights reserved.</div>`;
}
