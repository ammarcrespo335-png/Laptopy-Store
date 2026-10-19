const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for safe use inside HTML (content and attributes). Use it on EVERY dynamic value. */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const money = (amount, currency) => `${Number(amount).toLocaleString('en-US')} ${currency}`;

/** Escapes, then supports **bold**, "- " bullets and line breaks (used for Robin's replies). */
export const richText = (text) =>
  esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^- /gm, '• ').replace(/\n/g, '<br>');

export const debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

export const waLink = (number, text) => `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const mapLink = (address) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address} الجيزة مصر`)}`;

/** Pre-filled WhatsApp message (Arabic) for ordering a laptop. */
export const orderMessage = (laptop, currency) => {
  const specs = [laptop.cpu, laptop.ram, laptop.storage].filter(Boolean).join(' / ');
  return `مرحباً 👋 عايز أطلب ${laptop.brand} ${laptop.model}${specs ? ` (${specs})` : ''} بسعر ${Number(laptop.price).toLocaleString('en-US')} ${currency}`;
};

export function toast(message, type = 'ok') {
  const host = $('#toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}
