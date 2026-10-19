import { mountGoogleButton } from '../auth.js';
import { socialLinks } from '../components/social.js';
import { ICONS, MARK } from '../icons.js';
import { $, esc, waLink } from '../utils.js';
import { isAdmin, state, store } from '../state.js';

export function renderHeader() {
  const s = store();
  $('#top').innerHTML = `
    <div class="ann"><span dir="rtl" lang="ar">${esc(s.slogan)}</span> &nbsp;·&nbsp;
      <a href="${esc(waLink(s.whatsapp))}" target="_blank" rel="noopener">${ICONS.phone} ${esc(s.phone)}</a></div>
    <header class="hd">
      <a class="brand" href="#shop" data-action="nav" data-tab="shop" aria-label="${esc(s.name)} – home">${MARK}<span>${esc(s.name)}</span></a>
      <div class="hsoc">${socialLinks(['ig', 'tt', 'fb'])}</div>
      <nav class="tabs" id="tabs" aria-label="Main"></nav>
      <div class="hr">
        <button type="button" class="btn primary" data-action="open-chat">${ICONS.spark} Ask Robin</button>
        <div class="auth" id="auth"></div>
      </div>
    </header>`;
  renderTabs();
  renderAuth();
}

export function renderTabs() {
  const tabs = [['shop', 'Devices'], ['compare', `Compare (${state.compare.length})`]];
  if (isAdmin()) tabs.push(['admin', 'Admin']);
  $('#tabs').innerHTML = tabs
    .map(([key, label]) => `<button type="button" data-action="nav" data-tab="${key}" ${(state.tab === 'laptop' ? 'shop' : state.tab) === key ? 'aria-current="page"' : ''}>${label}</button>`)
    .join('');
}

export function renderAuth() {
  const el = $('#auth');
  if (!el) return;
  const u = state.user;
  if (u) {
    el.innerHTML = `${u.picture ? `<img src="${esc(u.picture)}" alt="" referrerpolicy="no-referrer" width="30" height="30">` : ''}
      <span class="uname">${esc(u.name)}</span>${u.isAdmin ? '<span class="badge admin">Admin</span>' : ''}
      <button type="button" data-action="signout">Sign out</button>`;
  } else if (state.config.googleClientId) {
    el.innerHTML = '<div id="gbtn"></div>';
    mountGoogleButton($('#gbtn'));
  } else if (state.config.devAuth) {
    el.innerHTML = '<button type="button" data-action="dev-login">Dev sign in</button>';
  } else {
    el.innerHTML = '';
  }
}
