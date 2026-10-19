/**
 * Tiny event-delegation layer. Markup declares what it does with data attributes
 * (data-action, data-input, data-change, data-submit), so there are no inline
 * onclick handlers and the strict Content-Security-Policy stays intact.
 */
const registry = { click: new Map(), input: new Map(), change: new Map(), submit: new Map() };
const ATTRIBUTE = { click: 'action', input: 'input', change: 'change', submit: 'submit' };

export const onClick = (name, fn) => registry.click.set(name, fn);
export const onInput = (name, fn) => registry.input.set(name, fn);
export const onChange = (name, fn) => registry.change.set(name, fn);
export const onSubmit = (name, fn) => registry.submit.set(name, fn);

export function startEvents() {
  for (const type of Object.keys(registry)) {
    const attr = ATTRIBUTE[type];
    document.addEventListener(type, (event) => {
      const el = event.target.closest?.(`[data-${attr}]`);
      if (!el || el.disabled) return;
      const handler = registry[type].get(el.dataset[attr]);
      if (!handler) return;
      if (type === 'submit') event.preventDefault();
      handler(el, event);
    });
  }
}
