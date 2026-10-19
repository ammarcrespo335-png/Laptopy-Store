import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const clone = (v) => structuredClone(v);
const newId = () => `l_${crypto.randomBytes(5).toString('hex')}`;

/** Older data stored one `image`; the catalogue now keeps a list of `images`. */
function migrate(laptop) {
  if (!('image' in laptop)) return laptop;
  const { image, ...rest } = laptop;
  return { ...rest, images: rest.images ?? (image ? [image] : []) };
}

/**
 * JSON-file persistence for laptops.
 *
 * - Reads everything into memory at start-up (a shop catalogue is small).
 * - Every mutation runs inside a lock, so overlapping requests cannot lose updates.
 * - Files are written atomically (temp file + rename), so a crash never leaves a half-written file.
 *
 * To move to a real database later, keep this public interface and swap the internals.
 */
export class LaptopRepository {
  #file;
  #seedPath;
  #items = [];
  #lock = Promise.resolve();

  constructor({ dataDir, seedPath }) {
    this.#file = path.join(dataDir, 'laptops.json');
    this.#seedPath = seedPath;
  }

  async init() {
    await fs.mkdir(path.dirname(this.#file), { recursive: true });
    try {
      this.#items = JSON.parse(await fs.readFile(this.#file, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.#items = JSON.parse(await fs.readFile(this.#seedPath, 'utf8'));
      await this.#write(this.#items);
    }
    const migrated = this.#items.map(migrate);
    if (migrated.some((l, i) => l !== this.#items[i])) {
      this.#items = migrated;
      await this.#write(migrated);
    }
    return this;
  }

  list() {
    return clone(this.#items);
  }

  get(id) {
    const found = this.#items.find((l) => l.id === id);
    return found ? clone(found) : null;
  }

  create(data) {
    const now = new Date().toISOString();
    const item = { id: newId(), ...data, createdAt: now, updatedAt: now };
    return this.#mutate((items) => ({ next: [...items, item], result: clone(item) }));
  }

  update(id, patch) {
    return this.updateWith(id, (current) => ({ ...current, ...patch }));
  }

  /** Read-modify-write one laptop inside the lock. `change` receives a copy and returns the new version (it may throw). */
  updateWith(id, change) {
    return this.#mutate((items) => {
      const index = items.findIndex((l) => l.id === id);
      if (index < 0) return { next: null, result: null };
      const updated = { ...change(clone(items[index])), id, updatedAt: new Date().toISOString() };
      const next = items.slice();
      next[index] = updated;
      return { next, result: clone(updated) };
    });
  }

  /** Deletes a laptop and returns it (so callers can clean up its photos), or null if it does not exist. */
  remove(id) {
    return this.#mutate((items) => {
      const found = items.find((l) => l.id === id);
      if (!found) return { next: null, result: null };
      return { next: items.filter((l) => l.id !== id), result: clone(found) };
    });
  }

  /**
   * Applies many changes with ONE atomic write (used by the Excel import).
   * @param create     full laptop objects to add
   * @param update     [{ id, patch }]
   * @param removeIds  ids to delete (returns the removed laptops)
   */
  apply({ create = [], update = [], removeIds = [] }) {
    return this.#mutate((items) => {
      const now = new Date().toISOString();
      const removing = new Set(removeIds);
      const patches = new Map(update.map((u) => [u.id, u.patch]));
      const removed = items.filter((l) => removing.has(l.id));
      let updated = 0;
      const kept = items
        .filter((l) => !removing.has(l.id))
        .map((l) => {
          if (!patches.has(l.id)) return l;
          updated += 1;
          return { ...l, ...patches.get(l.id), id: l.id, updatedAt: now };
        });
      const created = create.map((data) => ({ id: newId(), ...data, createdAt: now, updatedAt: now }));
      return { next: [...kept, ...created], result: { created: created.length, updated, removed: clone(removed) } };
    });
  }

  #mutate(fn) {
    const run = this.#lock.catch(() => {}).then(async () => {
      const { next, result } = fn(this.#items);
      if (next) {
        await this.#write(next);
        this.#items = next;
      }
      return result;
    });
    this.#lock = run;
    return run;
  }

  async #write(items) {
    const tmp = `${this.#file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(items, null, 2), 'utf8');
    await fs.rename(tmp, this.#file);
  }
}
