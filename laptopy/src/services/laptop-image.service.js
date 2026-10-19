import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { badRequest, notFound } from '../utils/http-error.js';
import { logger } from '../utils/logger.js';
import { MAX_IMAGES } from '../validators/laptop.schema.js';

/** Detects the real image type from the file's first bytes (never trusts the file name or Content-Type). */
export function detectImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null; // SVG and everything else is refused on purpose (SVG can carry scripts)
}

/** Photos uploaded from the admin panel: stored in DATA_DIR/uploads and listed in laptop.images. */
export class LaptopImageService {
  constructor({ repository, uploadsDir }) {
    this.repo = repository;
    this.dir = uploadsDir;
  }

  async init() {
    await fs.mkdir(this.dir, { recursive: true });
    return this;
  }

  /** @returns the updated laptop (raw record), or throws */
  async add(laptopId, buffer) {
    if (!this.repo.get(laptopId)) throw notFound('Laptop not found.');
    const type = detectImageType(buffer);
    if (!type) throw badRequest('Please upload a JPG, PNG or WebP photo.', 'unsupported_image');

    const name = `${laptopId}-${crypto.randomBytes(6).toString('hex')}.${type}`;
    await fs.writeFile(path.join(this.dir, name), buffer);
    try {
      return await this.repo.updateWith(laptopId, (laptop) => {
        const images = laptop.images ?? [];
        if (images.length >= MAX_IMAGES) throw badRequest(`A laptop can have at most ${MAX_IMAGES} photos.`, 'too_many_images');
        return { ...laptop, images: [...images, `/uploads/${name}`] };
      });
    } catch (err) {
      await this.#unlink(`/uploads/${name}`);
      throw err;
    }
  }

  /** Removes the photo at `index` (and deletes the file if it was an upload). */
  async removeAt(laptopId, index) {
    let removedUrl = null;
    const updated = await this.repo.updateWith(laptopId, (laptop) => {
      const images = laptop.images ?? [];
      if (!Number.isInteger(index) || index < 0 || index >= images.length) throw notFound('Photo not found.');
      removedUrl = images[index];
      return { ...laptop, images: images.filter((_, i) => i !== index) };
    });
    if (!updated) throw notFound('Laptop not found.');
    await this.#unlink(removedUrl);
    return updated;
  }

  /** Deletes the uploaded files that belonged to removed laptops / replaced photo lists. */
  async cleanup(urls) {
    await Promise.all((urls ?? []).map((u) => this.#unlink(u)));
  }

  async #unlink(url) {
    if (typeof url !== 'string' || !url.startsWith('/uploads/')) return;
    const file = path.join(this.dir, path.basename(url));
    try {
      await fs.unlink(file);
    } catch (err) {
      if (err.code !== 'ENOENT') logger.warn('Could not delete photo', file, err.message);
    }
  }
}
