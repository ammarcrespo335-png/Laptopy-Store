import { $, $$, money } from '../utils.js';
import { state, store, visibleLaptops } from '../state.js';

/** Slider step: finer for small price ranges, coarser for big ones. */
export const stepFor = (lo, hi) => (hi - lo > 40000 ? 1000 : 500);

/** [lowest, highest] price in stock, rounded to the slider step. */
export function priceBounds(laptops = visibleLaptops()) {
  if (!laptops.length) return [0, 500];
  const prices = laptops.map((l) => l.price);
  const step = stepFor(Math.min(...prices), Math.max(...prices));
  const lo = Math.floor(Math.min(...prices) / step) * step;
  const hi = Math.ceil(Math.max(...prices) / step) * step;
  return [lo, hi > lo ? hi : lo + step];
}

export const priceRange = () => {
  const [lo, hi] = priceBounds();
  return [state.filters.min ?? lo, state.filters.max ?? hi];
};

/** Two-thumb range slider (two stacked native range inputs, so keyboard and touch work out of the box). */
export function priceSliderHTML() {
  const [lo, hi] = priceBounds();
  const [a, b] = priceRange();
  const STEP = stepFor(lo, hi);
  const cur = store().currency;
  const left = ((a - lo) / (hi - lo)) * 100;
  const right = 100 - ((b - lo) / (hi - lo)) * 100;
  return `<div class="rv"><span id="rv0">${money(a, cur)}</span><span id="rv1">${money(b, cur)}</span></div>
    <div class="rng">
      <div class="rb"><i id="rt" style="left:${left}%;right:${right}%"></i></div>
      <input type="range" min="${lo}" max="${hi}" step="${STEP}" value="${a}" data-input="price" data-which="min" aria-label="Minimum price">
      <input type="range" min="${lo}" max="${hi}" step="${STEP}" value="${b}" data-input="price" data-which="max" aria-label="Maximum price">
    </div>`;
}

/** Applies a moved thumb to the filters and updates the labels and track (no re-render, so dragging stays smooth). */
export function applySliderInput(input) {
  const [lo, hi] = priceBounds();
  const STEP = stepFor(lo, hi);
  let [a, b] = priceRange();
  const value = Number(input.value);
  if (input.dataset.which === 'min') a = Math.min(value, b - STEP);
  else b = Math.max(value, a + STEP);

  state.filters.min = a <= lo ? null : a;
  state.filters.max = b >= hi ? null : b;

  const track = $('#rt').style;
  track.left = `${((a - lo) / (hi - lo)) * 100}%`;
  track.right = `${100 - ((b - lo) / (hi - lo)) * 100}%`;
  const cur = store().currency;
  $('#rv0').textContent = money(a, cur);
  $('#rv1').textContent = money(b, cur);
  const [minInput, maxInput] = $$('.rng input');
  minInput.value = a;
  maxInput.value = b;
}
