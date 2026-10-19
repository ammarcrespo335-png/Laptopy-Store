import { laptopArt } from './components/laptopArt.js';
import { byId } from './state.js';

/** Cursor spotlight, button ripples and image fallbacks. */
export function startEffects() {
  const root = document.documentElement.style;
  let frame = 0;
  addEventListener('pointermove', (e) => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      root.setProperty('--mx', `${e.clientX}px`);
      root.setProperty('--my', `${e.clientY}px`);
      frame = 0;
    });
  });

  addEventListener('pointerdown', (e) => {
    const target = e.target.closest?.('button:not(.fab):not(.rm), .btn, .so, .wab');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.2;
    const ripple = document.createElement('span');
    ripple.className = 'rp';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
    target.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  });

  // A laptop photo that fails to load falls back to the generated illustration.
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;
      const laptop = byId(img.dataset.fallback);
      if (laptop) img.replaceWith(...new DOMParser().parseFromString(laptopArt(laptop), 'text/html').body.childNodes);
    },
    true,
  );
}
