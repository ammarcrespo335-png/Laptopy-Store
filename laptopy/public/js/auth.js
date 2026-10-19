import { api } from './api.js';
import { hooks } from './hooks.js';
import { state } from './state.js';
import { toast } from './utils.js';

let gisReady = false;
let gisLoading = null;

function loadGoogleScript() {
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(script);
  });
  return gisLoading;
}

async function onCredential(response) {
  try {
    const { user } = await api.googleLogin(response.credential);
    state.user = user;
    toast(user.isAdmin ? `Welcome back, ${user.name} (admin)` : `Signed in as ${user.email}`);
    await hooks.refreshAfterAuth();
  } catch (err) {
    toast(err.message || 'Sign-in failed', 'error');
  }
}

/** Loads "Sign in with Google" when a client id is configured. */
export async function initAuth() {
  if (!state.config.googleClientId) return;
  try {
    const google = await loadGoogleScript();
    google.accounts.id.initialize({
      client_id: state.config.googleClientId,
      callback: onCredential,
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    gisReady = true;
    hooks.renderAuth();
  } catch {
    /* offline or blocked: the site works without signing in */
  }
}

/** Draws Google's official button into `el` (only once the script is ready). */
export function mountGoogleButton(el) {
  if (!gisReady || !el) return;
  window.google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'medium', shape: 'pill', text: 'signin' });
}

export async function signOut() {
  await api.logout().catch(() => {});
  window.google?.accounts?.id?.disableAutoSelect();
  state.user = null;
  toast('Signed out');
  await hooks.refreshAfterAuth();
}

/** Local testing only (server must run with DEV_AUTH=true). */
export async function devSignIn() {
  const email = window.prompt('E-mail to sign in as (local testing only):', 'ramezmilab@gmail.com');
  if (!email) return;
  try {
    const { user } = await api.devLogin(email.trim());
    state.user = user;
    toast(`Signed in as ${user.email}${user.isAdmin ? ' (admin)' : ''}`);
    await hooks.refreshAfterAuth();
  } catch (err) {
    toast(err.message, 'error');
  }
}
