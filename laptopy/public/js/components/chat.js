import { ApiError, streamChat } from '../api.js';
import { onClick, onSubmit } from '../events.js';
import { ICONS, ROBOT } from '../icons.js';
import { $, $$, esc, money, richText, waLink } from '../utils.js';
import { state, store, visibleLaptops } from '../state.js';
import { compareButtonHTML, orderLinkHTML } from './laptopCard.js';

const STORAGE_KEY = 'laptopy-robin';
const MAX_HISTORY = 12;
const QUICK = [
  'عايز لابتوب للجامعة',
  'عايز لاب للبرمجة',
  'لابتوب جيمنج ميزانيتي 40,000 جنيه',
  'لابتوب للمونتاج والتصميم',
  'لابتوب خفيف وبطاريته تعيش كتير',
];

const chat = { open: false, busy: false, messages: [], rendered: 0 };

const greetingText = () =>
  `أهلاً بيك! أنا **روبن**، خبير اللابتوبات في **${store().name}**. قولي **ميزانيتك** وهتستخدم اللابتوب في إيه (دراسة، برمجة، جيمنج، تصميم، شغل...) وأنا هرشحلك أنسب لابتوب من اللي عندنا.`;

/** Arabic first, with the English line in its own left-to-right block so punctuation stays correct. */
const greetingHTML = () =>
  `<div class="m a" dir="auto"><div class="txt">${richText(greetingText())}<div dir="ltr" class="en">You can also chat with me in English.</div></div></div>`;

function save() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chat.messages.filter((m) => !m.pending).slice(-20)));
  } catch { /* storage unavailable (private mode): the chat still works */ }
}

function load() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
    if (Array.isArray(saved)) chat.messages = saved.filter((m) => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role));
  } catch { /* ignore corrupted data */ }
}

/**
 * Devices named in Robin's answer, as small cards with Compare / Order buttons.
 * A model can exist in several versions (different specs and prices), so a card is only shown for the version
 * whose price appears in the answer (or the cheapest one when no price is mentioned); at most three cards.
 */
function suggestionsHTML(text) {
  const cur = store().currency;
  const byModel = new Map();
  for (const l of visibleLaptops()) {
    if (!text.includes(l.model)) continue;
    const key = `${l.brand}|${l.model}|${l.type}`;
    byModel.set(key, [...(byModel.get(key) ?? []), l]);
  }
  const mentionsPrice = (l) => [l.price.toLocaleString('en-US'), String(l.price)].some((p) => text.includes(p));
  const picked = [...byModel.values()]
    .map((versions) => versions.find(mentionsPrice) ?? [...versions].sort((a, b) => a.price - b.price)[0])
    .slice(0, 3);
  return picked
    .map((l) => `<div class="mini"><span><b>${esc(l.brand)} ${esc(l.model)}</b><br>${esc([l.cpu, l.ram, l.storage].filter(Boolean).join(' · '))}<br>${money(l.price, cur)}</span>
      <span class="acts">${compareButtonHTML(l.id, 'btn small cmpb')}${orderLinkHTML(l, 'btn small wa', 'Order')}<a class="btn small" href="#laptop/${encodeURIComponent(l.id)}">Details</a></span></div>`)
    .join('');
}

function bubbleHTML(m, animate) {
  const mine = m.role === 'user';
  const body = m.content ? richText(m.content) : '<span class="dots" role="status" aria-label="Robin is typing"><i></i><i></i><i></i></span>';
  const extra = mine || m.pending ? '' : suggestionsHTML(m.content);
  const note = m.mode === 'local' && state.config.aiEnabled && !mine ? '<div class="note">Instant suggestions (the AI assistant is busy right now).</div>' : '';
  return `<div class="m ${mine ? 'u' : 'a'}${animate ? ' pp' : ''}" dir="auto"><div class="txt">${body}</div>${extra ? `<div class="mc">${extra}</div>` : ''}${note}</div>`;
}

function renderMessages() {
  const box = $('#chat');
  const fresh = chat.messages.length > chat.rendered;
  chat.rendered = chat.messages.length;
  const hasUser = chat.messages.some((m) => m.role === 'user');
  box.innerHTML =
    greetingHTML() +
    chat.messages.map((m, i) => bubbleHTML(m, fresh && i >= chat.messages.length - 2)).join('') +
    (hasUser ? '' : `<div class="qk" aria-label="Suggested questions">${QUICK.map((t) => `<button type="button" data-action="chat-quick" data-text="${esc(t)}" dir="auto">${esc(t)}</button>`).join('')}</div>`);
  box.scrollTop = box.scrollHeight;
}

/** While Robin is typing: update only the last bubble (no full re-render, no flicker). */
function updateLastBubble() {
  const bubble = $$('#chat .m').at(-1);
  const last = chat.messages.at(-1);
  if (!bubble || !last) return;
  bubble.querySelector('.txt').innerHTML = last.content ? richText(last.content) : '';
  const box = $('#chat');
  box.scrollTop = box.scrollHeight;
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Typewriter effect: whatever arrives from the server (even all at once) is revealed gradually.
 * It speeds up when a lot of text is waiting, so a long answer never lags far behind.
 */
function createTypewriter(reply) {
  let target = '';
  let shown = 0;
  let timer = null;
  let onDrained = null;
  const tick = () => {
    const waiting = target.length - shown;
    if (waiting <= 0) {
      clearInterval(timer);
      timer = null;
      onDrained?.();
      onDrained = null;
      return;
    }
    shown = Math.min(target.length, shown + Math.max(1, Math.ceil(waiting / 50)));
    if (/[\uD800-\uDBFF]/.test(target[shown - 1] ?? '')) shown = Math.min(target.length, shown + 1); // never split an emoji
    reply.content = target.slice(0, shown);
    updateLastBubble();
  };
  return {
    push(text) {
      target += text;
      if (reduceMotion()) {
        shown = target.length;
        reply.content = target;
        updateLastBubble();
      } else if (!timer) timer = setInterval(tick, 18);
    },
    /** Resolves once everything received so far has been shown. */
    done: () => new Promise((resolve) => (shown >= target.length ? resolve() : (onDrained = resolve))),
    get text() {
      return target;
    },
  };
}

async function send(text) {
  if (chat.busy || !text.trim()) return;
  chat.busy = true;
  chat.messages.push({ role: 'user', content: text.trim() });
  const reply = { role: 'assistant', content: '', pending: true };
  chat.messages.push(reply);
  renderMessages();
  $('#chat-send').disabled = true;

  const history = chat.messages
    .filter((m) => !m.pending)
    .slice(-MAX_HISTORY)
    .map(({ role, content }) => ({ role, content: content.slice(0, 3500) }));

  const typer = createTypewriter(reply);
  try {
    const result = await streamChat(history, { onDelta: (delta) => typer.push(delta) });
    reply.mode = result.mode;
  } catch (err) {
    if (!typer.text) {
      typer.push(err instanceof ApiError && err.status === 429
        ? err.message
        : 'ماقدرتش أرد دلوقتي، جرّب تاني بعد شوية.\nSorry, I could not answer right now. Please try again.');
    }
  }
  await typer.done();
  reply.content = typer.text;
  delete reply.pending;
  chat.busy = false;
  $('#chat-send').disabled = false;
  save();
  renderMessages();
  $('#chat-input').focus();
}

export function openChat() {
  chat.open = true;
  $('#panel').classList.add('show', 'anim');
  $('#fab').classList.add('hide');
  $('#fab').setAttribute('aria-expanded', 'true');
  $('#chat').scrollTop = $('#chat').scrollHeight;
  setTimeout(() => $('#chat-input').focus(), 60);
}

export function closeChat() {
  chat.open = false;
  $('#panel').classList.remove('show', 'anim');
  $('#fab').classList.remove('hide');
  $('#fab').setAttribute('aria-expanded', 'false');
  $('#fab').focus();
}

/** Opens the chat and sends a question (used by "Ask Robin about this laptop"). */
export function askRobin(text) {
  openChat();
  return send(text);
}

/** Builds the Robin chat window and the floating buttons. */
export function initChat() {
  load();
  const s = store();
  $('#bot').innerHTML = `
    <a class="wfab" href="${esc(waLink(s.whatsapp, 'مرحباً 👋'))}" target="_blank" rel="noopener" aria-label="Chat with the team on WhatsApp">${ICONS.wa}</a>
    <button type="button" class="fab" id="fab" data-action="open-chat" aria-haspopup="dialog" aria-expanded="false" aria-label="Chat with Robin, our AI laptop expert">
      <span class="pulse"></span>${ROBOT}<span class="tip">Chat with Robin</span>
    </button>
    <section class="panel" id="panel" role="dialog" aria-label="Chat with Robin">
      <div class="ph">
        <div class="av">${ROBOT}</div>
        <div><b>Robin</b><div class="st">Online · عربي / English</div></div>
        <button type="button" data-action="close-chat" aria-label="Close chat">${ICONS.close}</button>
      </div>
      <div class="chat" id="chat" aria-live="polite"></div>
      <form class="pf" data-submit="chat-send">
        <input id="chat-input" name="text" dir="auto" autocomplete="off" maxlength="500" placeholder="اكتب ميزانيتك واستخدامك… / Type here" aria-label="Your message">
        <button type="submit" id="chat-send" aria-label="Send message">${ICONS.send}</button>
      </form>
      <a class="wl" href="${esc(waLink(s.whatsapp))}" target="_blank" rel="noopener">${ICONS.wa} Prefer to talk to our team? WhatsApp us</a>
    </section>`;
  renderMessages();

  onClick('open-chat', openChat);
  onClick('close-chat', closeChat);
  onClick('chat-quick', (el) => send(el.dataset.text));
  onSubmit('chat-send', (form) => {
    const input = form.elements.text;
    const text = input.value;
    input.value = '';
    send(text);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chat.open) closeChat();
  });
}
