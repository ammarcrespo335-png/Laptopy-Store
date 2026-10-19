import { LAPTOP_DEFAULTS } from '../validators/laptop.schema.js';
import { photosSearchUrl } from './price-list.normalizer.js';

const AUTO_LINK = 'https://www.google.com/search?tbm=isch&q=';

/** Fields exposed over the API (internal timestamps stay private). */
export const toDto = (l) => ({
  id: l.id,
  type: l.type ?? 'Laptop',
  brand: l.brand,
  model: l.model,
  price: l.price,
  cpu: l.cpu,
  ram: l.ram,
  storage: l.storage,
  screen: l.screen ?? '',
  gpu: l.gpu ?? '',
  battery: l.battery ?? '',
  weight: l.weight ?? '',
  notes: l.notes ?? '',
  description: l.description ?? '',
  os: l.os ?? '',
  color: l.color ?? '',
  ports: l.ports ?? '',
  warranty: l.warranty ?? '',
  images: l.images ?? [],
  // "View photos": the owner's own link, otherwise a Google Images search for the exact product name
  photosUrl: l.photosUrl || photosSearchUrl({ brand: l.brand, model: l.model, type: l.type ?? 'Laptop' }),
  inStock: l.inStock !== false,
});

/** Business rules around laptops. Input is already validated by the controller layer. */
export class LaptopService {
  constructor(repository, images) {
    this.repo = repository;
    this.images = images;
  }

  /** Laptops customers can see. */
  listPublic() {
    return this.repo.list().filter((l) => l.inStock !== false).map(toDto);
  }

  /** Everything, including hidden / out-of-stock items (admin only – enforced by the route). */
  listAll() {
    return this.repo.list().map(toDto);
  }

  getPublic(id) {
    const item = this.repo.get(id);
    return item && item.inStock !== false ? toDto(item) : null;
  }

  async create(input) {
    return toDto(await this.repo.create({ ...LAPTOP_DEFAULTS, ...input }));
  }

  async update(id, patch) {
    const before = this.repo.get(id);
    // renamed laptop with an automatic photos link: search for the new name
    if (before && (patch.brand || patch.model) && patch.photosUrl === undefined && (before.photosUrl ?? '').startsWith(AUTO_LINK)) {
      patch = { ...patch, photosUrl: photosSearchUrl({ brand: patch.brand ?? before.brand, model: patch.model ?? before.model, type: patch.type ?? before.type }) };
    }
    const updated = await this.repo.update(id, patch);
    if (before && updated && patch.images) {
      // photos dropped from the list: delete the uploaded files that are no longer used
      const kept = new Set(updated.images ?? []);
      await this.images?.cleanup((before.images ?? []).filter((u) => !kept.has(u)));
    }
    return updated ? toDto(updated) : null;
  }

  /** Deletes a laptop together with its uploaded photos. */
  async remove(id) {
    const removed = await this.repo.remove(id);
    if (!removed) return false;
    await this.images?.cleanup(removed.images);
    return true;
  }
}
