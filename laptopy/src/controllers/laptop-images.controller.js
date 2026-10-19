import { badRequest } from '../utils/http-error.js';
import { toDto } from '../services/laptop.service.js';

export function createLaptopImagesController({ images }) {
  return {
    /** Adds one photo (raw JPG/PNG/WebP bytes as the request body). */
    async upload(req, res) {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw badRequest('Choose a photo first.', 'no_file');
      res.status(201).json({ laptop: toDto(await images.add(req.params.id, req.body)) });
    },

    async remove(req, res) {
      res.json({ laptop: toDto(await images.removeAt(req.params.id, Number(req.params.index))) });
    },
  };
}
