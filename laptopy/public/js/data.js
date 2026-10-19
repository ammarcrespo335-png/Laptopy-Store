import { api } from './api.js';
import { isAdmin, state, visibleLaptops } from './state.js';

/** Loads the catalogue (admins also get hidden items) and drops selections that no longer exist. */
export async function reloadLaptops() {
  const { laptops } = await api.laptops({ all: isAdmin() });
  state.laptops = laptops;
  const visible = new Set(visibleLaptops().map((l) => l.id));
  state.compare = state.compare.filter((id) => visible.has(id));
  state.verdict = null;
}
