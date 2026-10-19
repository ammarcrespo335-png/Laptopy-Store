/** Single source of truth for the page. Views read from it; handlers change it and re-render. */
export const state = {
  config: null, // { store, googleClientId, devAuth, aiEnabled }
  laptops: [], // everything the API returned (admin also receives hidden items)
  user: null, // { email, name, picture, isAdmin } | null
  tab: 'shop', // 'shop' | 'compare' | 'admin' | 'laptop'
  laptopId: null, // which laptop the detail page shows
  filters: { q: '', type: '', brand: '', sort: '', min: null, max: null },
  shown: 24, // how many cards the catalogue shows ("Show more" adds 24)
  invQ: '', // admin inventory filter
  invShown: 40,
  compare: [], // laptop ids, in selection order
  verdict: null, // { text, mode } | null
  editingId: null,
  import: null, // Excel import in progress: { name, buffer, replace, report, done }
};

export const MAX_COMPARE = 4;
export const isAdmin = () => Boolean(state.user?.isAdmin);
export const visibleLaptops = () => state.laptops.filter((l) => l.inStock !== false);
export const byId = (id) => state.laptops.find((l) => l.id === id);
export const store = () => state.config.store;
