import { api } from './api.js';
import { devSignIn, initAuth, signOut } from './auth.js';
import { initChat } from './components/chat.js';
import { placeLaptop } from './components/laptop3d.js';
import { syncCompareButtons } from './components/laptopCard.js';
import { reloadLaptops } from './data.js';
import { startEffects } from './effects.js';
import { onClick, startEvents } from './events.js';
import { hooks } from './hooks.js';
import { MAX_COMPARE, byId, isAdmin, state } from './state.js';
import { $, esc, toast } from './utils.js';
import { adminPage, registerAdminHandlers } from './views/admin.js';
import { closeViewer, productPage, registerProductHandlers } from './views/product.js';
import { comparePage, registerCompareHandlers } from './views/compare.js';
import { footerHTML } from './views/footer.js';
import { renderAuth, renderHeader, renderTabs } from './views/header.js';
import { registerShopHandlers, shopPage } from './views/shop.js';

const TABS = ['shop', 'compare', 'admin'];
const TITLES = { shop: 'Laptopy – لابتوبي', compare: 'Compare laptops – Laptopy', admin: 'Admin – Laptopy' };
let entranceTimer;

/** #shop, #compare, #admin or #laptop/<id> */
const routeFromHash = () => {
  const [tab, id] = location.hash.slice(1).split('/');
  if (tab === 'laptop' && id) return { tab: 'laptop', id: decodeURIComponent(id) };
  return { tab: TABS.includes(tab) ? tab : 'shop', id: null };
};

function pageHTML() {
  if (state.tab === 'compare') return comparePage();
  if (state.tab === 'admin') return adminPage();
  if (state.tab === 'laptop') return productPage();
  return shopPage();
}

/** Draws the current page. `animate` plays the entrance animation (only when the person navigates). */
function renderPage({ animate = false } = {}) {
  const page = $('#page');
  page.innerHTML = pageHTML();
  page.classList.toggle('pg', animate);
  clearTimeout(entranceTimer);
  if (animate) entranceTimer = setTimeout(() => page.classList.remove('pg'), 1800);
  if (state.tab === 'shop') placeLaptop(state.config.store.name);
  const laptop = state.tab === 'laptop' ? byId(state.laptopId) : null;
  document.title = laptop ? `${laptop.brand} ${laptop.model} – Laptopy` : TITLES[state.tab] ?? TITLES.shop;
}

function go({ tab, id = null }) {
  closeViewer();
  if (tab === 'admin' && !isAdmin()) {
    tab = 'shop';
    history.replaceState(null, '', '#shop');
  }
  state.tab = tab;
  state.laptopId = id;
  renderTabs();
  renderPage({ animate: true });
  window.scrollTo(0, 0);
}

function setCompare(ids) {
  state.compare = ids;
  state.verdict = null;
  renderTabs();
  if (state.tab === 'compare') renderPage({ animate: true });
}

function toggleCompare(id) {
  const index = state.compare.indexOf(id);
  if (index >= 0) {
    setCompare(state.compare.filter((x) => x !== id));
  } else if (state.compare.length >= MAX_COMPARE) {
    toast(`You can compare up to ${MAX_COMPARE} laptops at once.`, 'error');
    return;
  } else {
    setCompare([...state.compare, id]);
  }
  syncCompareButtons(id);
}

async function reloadAndRender() {
  await reloadLaptops();
  renderTabs();
  renderPage({ animate: false });
}

async function refreshAfterAuth() {
  await reloadLaptops();
  renderAuth();
  renderTabs();
  if (state.tab === 'admin' && !isAdmin()) go({ tab: 'shop' });
  else renderPage({ animate: false });
}

function registerHandlers() {
  onClick('nav', (el, event) => {
    event.preventDefault();
    const tab = el.dataset.tab;
    if (location.hash === `#${tab}`) go({ tab });
    else location.hash = tab;
  });
  onClick('toggle-compare', (el) => toggleCompare(el.dataset.id));
  onClick('signout', signOut);
  onClick('dev-login', devSignIn);
  registerShopHandlers();
  registerCompareHandlers();
  registerAdminHandlers();
  registerProductHandlers();
}

async function boot() {
  Object.assign(hooks, { renderPage, renderAuth, setCompare, toggleCompare, refreshAfterAuth, reloadAndRender });
  startEvents();
  startEffects();
  registerHandlers();

  try {
    const [config, me] = await Promise.all([api.config(), api.me()]);
    state.config = config;
    state.user = me.user;
    await reloadLaptops();
  } catch (err) {
    $('#page').innerHTML = `<main class="wrap"><h1>We could not load the store</h1><p class="mu">${esc(err.message)}</p><a class="btn primary" href="/">Try again</a></main>`;
    return;
  }

  const first = routeFromHash();
  state.tab = first.tab === 'admin' && !isAdmin() ? 'shop' : first.tab;
  state.laptopId = first.id;
  renderHeader();
  $('#foot').innerHTML = footerHTML();
  renderPage({ animate: true });
  initChat();
  window.addEventListener('hashchange', () => go(routeFromHash()));
  initAuth();
}

boot();
