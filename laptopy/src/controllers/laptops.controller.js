import { notFound } from '../utils/http-error.js';
import { laptopCreateSchema, laptopPatchSchema } from '../validators/laptop.schema.js';

export function createLaptopsController({ laptops }) {
  return {
    /** Public catalogue. `?all=1` (hidden / out-of-stock items too) is honoured for the admin only. */
    list(req, res) {
      const wantsAll = req.query.all === '1' && req.user?.isAdmin;
      res.json({ laptops: wantsAll ? laptops.listAll() : laptops.listPublic() });
    },

    get(req, res) {
      const item = req.user?.isAdmin
        ? laptops.listAll().find((l) => l.id === req.params.id)
        : laptops.getPublic(req.params.id);
      if (!item) throw notFound('Laptop not found.');
      res.json({ laptop: item });
    },

    // ---- admin only (guarded in the routes) ----

    async create(req, res) {
      const input = laptopCreateSchema.parse(req.body);
      res.status(201).json({ laptop: await laptops.create(input) });
    },

    /** Partial update, e.g. { "price": 21500 } or { "inStock": false }. */
    async patch(req, res) {
      const patch = laptopPatchSchema.parse(req.body);
      const updated = await laptops.update(req.params.id, patch);
      if (!updated) throw notFound('Laptop not found.');
      res.json({ laptop: updated });
    },

    async remove(req, res) {
      if (!(await laptops.remove(req.params.id))) throw notFound('Laptop not found.');
      res.status(204).end();
    },
  };
}
