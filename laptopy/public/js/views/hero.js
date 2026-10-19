import { laptopSlotHTML } from '../components/laptop3d.js';
import { ICONS, MARK } from '../icons.js';
import { esc, waLink } from '../utils.js';
import { store, visibleLaptops } from '../state.js';

export function heroHTML() {
  const s = store();
  const laptops = visibleLaptops();
  return `<section class="hero" aria-labelledby="home-title">
    <div class="hi">
      <div>
        <span class="pill" dir="rtl" lang="ar">${esc(s.slogan)}</span>
        <h1 id="home-title">${MARK}<span>${esc(s.name)}</span></h1>
        <p class="lead">Browse our laptops, desktops and towers with full specs and clear prices, compare models side by side, or let Robin, our AI expert, find your perfect match.</p>
        <div class="row">
          <button type="button" class="btn primary" data-action="open-chat">${ICONS.spark} Chat with Robin</button>
          <button type="button" class="btn ghost" data-action="scroll-shop">Browse devices</button>
          <a class="btn wa" href="${esc(waLink(s.whatsapp, 'مرحباً 👋 عايز أستفسر عن لابتوب'))}" target="_blank" rel="noopener">${ICONS.wa} WhatsApp</a>
        </div>
        <div class="stats"><div><b>${laptops.length}</b>Devices in stock</div><div><b>AI</b>Expert advice</div><div><b>2+</b>Side-by-side compare</div></div>
      </div>
      <div class="hv">
        ${laptopSlotHTML()}
        <div class="fl a">${ICONS.check} Full specifications</div>
        <div class="fl b">${ICONS.spark} Picked by Robin</div>
      </div>
    </div>
  </section>
  <div class="feat">
    <div><b>${ICONS.doc} Full specs</b><span>Every detail listed, no surprises</span></div>
    <div><b>${ICONS.scale} Easy comparison</b><span>Compare 2 or more models side by side</span></div>
    <div><b>${ICONS.spark} Robin, AI expert</b><span>Share your budget, get the right laptop</span></div>
  </div>`;
}
