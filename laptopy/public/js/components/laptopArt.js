import { esc } from '../utils.js';

/** Which kind of device is this? Anything that is not a Desktop or a Tower is drawn as a laptop. */
function deviceKind(l) {
  const t = String(l.type ?? '').toLowerCase();
  if (t.includes('tower')) return 'tower';
  if (t.includes('desktop') || t.includes('all-in-one') || t.includes('aio')) return 'desktop';
  return 'laptop';
}

/** A generated illustration (laptop, desktop or tower); its blue tone is derived from the brand + model. */
export function laptopArt(l) {
  let h = 0;
  for (const c of l.brand + l.model) h = (h * 31 + c.charCodeAt(0)) % 360;
  const a = 205 + (h % 45);
  const b = 225 + (h % 25);
  const defs = `<defs><linearGradient id="g${h}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${a} 85% 60%)"/><stop offset="1" stop-color="hsl(${b} 75% 28%)"/></linearGradient></defs>`;
  const kind = deviceKind(l);

  if (kind === 'desktop') {
    // monitor on a stand, keyboard in front, small desktop case on the right
    return `<svg viewBox="0 0 240 150" aria-hidden="true">${defs}<rect x="22" y="12" width="132" height="88" rx="8" fill="#10131f"/><rect x="27" y="17" width="122" height="74" rx="4" fill="url(#g${h})"/><path d="M27 76q32-24 64-8t58-16v39H27z" fill="#fff" opacity=".13"/><rect x="80" y="100" width="16" height="14" fill="#9aa0bd"/><rect x="60" y="113" width="56" height="6" rx="3" fill="#c9cde0"/><rect x="40" y="128" width="96" height="11" rx="3" fill="#dfe2f0"/><path d="M46 133h84" stroke="#9aa0bd" stroke-width="2" stroke-dasharray="4 3"/><rect x="166" y="64" width="56" height="64" rx="5" fill="#c9cde0"/><rect x="172" y="72" width="30" height="5" rx="2" fill="#9aa0bd"/><rect x="172" y="83" width="44" height="3" rx="1.5" fill="#9aa0bd"/><circle cx="208" cy="112" r="4.5" fill="hsl(${a} 85% 60%)"/></svg>`;
  }

  if (kind === 'tower') {
    // tall PC case with a side vent, drive bays and a power button, plus a small monitor beside it
    return `<svg viewBox="0 0 240 150" aria-hidden="true">${defs}<rect x="30" y="8" width="62" height="134" rx="7" fill="#10131f"/><rect x="36" y="14" width="50" height="122" rx="4" fill="url(#g${h})"/><rect x="42" y="22" width="38" height="7" rx="2" fill="#10131f" opacity=".55"/><rect x="42" y="34" width="38" height="7" rx="2" fill="#10131f" opacity=".55"/><g stroke="#fff" stroke-opacity=".3" stroke-width="2">${[70, 78, 86, 94, 102].map((y) => `<path d="M44 ${y}h34"/>`).join('')}</g><circle cx="61" cy="120" r="6" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2"/><path d="M61 115v5" stroke="#fff" stroke-opacity=".8" stroke-width="2"/><rect x="112" y="30" width="108" height="72" rx="7" fill="#10131f"/><rect x="117" y="35" width="98" height="60" rx="4" fill="url(#g${h})"/><path d="M117 80q26-20 52-6t46-12v33h-98z" fill="#fff" opacity=".13"/><rect x="160" y="102" width="12" height="14" fill="#9aa0bd"/><rect x="140" y="115" width="52" height="6" rx="3" fill="#c9cde0"/></svg>`;
  }

  return `<svg viewBox="0 0 240 150" aria-hidden="true">${defs}<rect x="40" y="14" width="160" height="104" rx="9" fill="#10131f"/><rect x="46" y="20" width="148" height="92" rx="5" fill="url(#g${h})"/><path d="M46 92q40-30 80-10t68-20v50H46z" fill="#fff" opacity=".13"/><circle cx="120" cy="17" r="1.6" fill="#667"/><path d="M14 124h212l-14 14a8 8 0 0 1-6 3H34a8 8 0 0 1-6-3z" fill="#c9cde0"/><rect x="100" y="124" width="40" height="5" rx="2.5" fill="#9aa0bd"/></svg>`;
}

/** The admin's photo when there is one, otherwise the illustration. */
export function laptopVisual(l) {
  const photo = l.images?.[0];
  return photo
    ? `<img src="${esc(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback="${esc(l.id)}">`
    : laptopArt(l);
}
