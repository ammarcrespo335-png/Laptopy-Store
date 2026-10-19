import { ICONS } from '../icons.js';
import { esc, waLink } from '../utils.js';
import { store } from '../state.js';

const LABELS = { ig: 'Instagram', tt: 'TikTok', fb: 'Facebook', wa: 'WhatsApp' };

/** Round icon links to the store's social pages: socialLinks(['ig','tt','fb']). */
export function socialLinks(keys) {
  const s = store();
  const urls = { ig: s.social.instagram, tt: s.social.tiktok, fb: s.social.facebook, wa: waLink(s.whatsapp) };
  return keys
    .map((k) => `<a class="so ${k}" href="${esc(urls[k])}" target="_blank" rel="noopener" aria-label="${LABELS[k]}">${ICONS[k]}</a>`)
    .join('');
}
