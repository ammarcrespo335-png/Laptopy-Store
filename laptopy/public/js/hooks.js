/**
 * Late-bound callbacks, filled in by main.js. They let views ask for a re-render
 * without importing main.js (which would create circular imports).
 */
export const hooks = {
  renderPage: () => {},
  renderAuth: () => {},
  setCompare: () => {},
  toggleCompare: () => {},
  refreshAfterAuth: async () => {},
  reloadAndRender: async () => {},
};
