import { $ } from '../utils.js';

/**
 * The hero laptop is a real-time 3D scene (WebGL, see assets-src/laptop-scene/main.js).
 * There is exactly ONE scene for the whole visit: its element is moved into the hero each time the home page
 * is drawn, so it is never rebuilt and the opening animation plays only once.
 *
 * Fallbacks: no WebGL or a loading problem -> a still picture of the finished scene (laptop-poster.webp).
 * Reduced motion -> the finished scene, rendered once, without movement.
 */
let host = null; // the persistent element: <div class="lap3d"><canvas/><img poster/></div>
let controller = null;
let started = false;
let onScreen = true;

/** Is WebGL available, and is it hardware accelerated? (software rendering is far too slow for this scene) */
function graphicsInfo() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!gl) return { ok: false, software: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, software: /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer) };
  } catch {
    return { ok: false, software: false };
  }
}

/** Wait until the browser is idle, so the page is usable before the 3D scene is prepared. */
const whenIdle = () =>
  new Promise((resolve) => (window.requestIdleCallback ? requestIdleCallback(resolve, { timeout: 1500 }) : setTimeout(resolve, 300)));

function createHost() {
  host = document.createElement('div');
  host.className = 'lap3d';
  host.id = 'lap';
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML =
    '<canvas class="lap3d-canvas"></canvas><img class="lap3d-poster" src="/assets/laptop-poster.webp" alt="" width="1400" height="1100" hidden>';

  // save battery: stop drawing while the laptop is off-screen or the tab is hidden
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      applyVisibility();
    }).observe(host);
  }
  document.addEventListener('visibilitychange', applyVisibility);
}

function applyVisibility() {
  if (!controller) return;
  if (onScreen && !document.hidden) controller.resume();
  else controller.pause();
}

function usePoster() {
  host.classList.add('poster');
  host.querySelector('img').hidden = false;
}

async function start(storeName) {
  const forced = new URLSearchParams(location.search).has('lapt'); // screenshots / poster generation
  const gpu = graphicsInfo();
  if (!gpu.ok || (gpu.software && !forced)) return usePoster();
  await whenIdle();
  try {
    const { mountLaptop } = await import('/vendor/laptop-scene.js');
    controller = await mountLaptop(host.querySelector('canvas'), {
      storeName,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      time: new URLSearchParams(location.search).get('lapt'), // ?lapt=4.2 freezes the animation at that second (used for screenshots)
      onSlow: () => {
        controller?.dispose();
        controller = null;
        usePoster(); // a device without graphics acceleration: show the still picture
      },
    });
    host.classList.add('ready');
    applyVisibility();
  } catch (err) {
    console.warn('The 3D laptop could not start; showing the still picture instead.', err);
    usePoster();
  }
}

export const laptopSlotHTML = () => '<div id="lap-slot"></div>';

/** Moves the laptop into the hero (and starts it the first time). */
export function placeLaptop(storeName) {
  if (!host) createHost();
  $('#lap-slot')?.replaceWith(host);
  if (!started) {
    started = true;
    start(storeName);
  }
}
