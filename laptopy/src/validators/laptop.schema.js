import { z } from 'zod';

export const MAX_IMAGES = 10;
/** Photos uploaded through the admin panel live at /uploads/<safe-file-name>. */
export const LOCAL_IMAGE = /^\/uploads\/[A-Za-z0-9._-]+\.(?:jpg|png|webp)$/;

const isHttps = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const text = (max) => z.string().trim().min(1, 'This field is required').max(max, `Maximum ${max} characters`);
const optionalText = (max) => z.string().trim().max(max, `Maximum ${max} characters`);

const imageRef = z
  .string()
  .trim()
  .max(500)
  .refine((v) => LOCAL_IMAGE.test(v) || isHttps(v), 'Photo links must start with https://');

export const TYPES = ['Laptop', 'Desktop', 'Tower'];

const shape = {
  brand: text(40),
  model: text(80),
  price: z.coerce.number('Price must be a number').positive('Price must be greater than 0').max(100_000_000),
  cpu: text(80),
  ram: text(40),
  storage: text(60),
  type: z.enum(TYPES),
  screen: optionalText(60),
  battery: optionalText(30),
  weight: optionalText(30),
  gpu: optionalText(80),
  notes: optionalText(200),
  description: optionalText(1500),
  os: optionalText(80),
  color: optionalText(60),
  ports: optionalText(200),
  warranty: optionalText(80),
  images: z.array(imageRef).max(MAX_IMAGES, `At most ${MAX_IMAGES} photos`),
  photosUrl: z.union([z.literal(''), z.string().trim().max(1000).refine(isHttps, 'The photos link must start with https://')]),
  inStock: z.boolean(),
};

const OPTIONAL = ['type', 'screen', 'battery', 'weight', 'gpu', 'notes', 'description', 'os', 'color', 'ports', 'warranty', 'images', 'photosUrl', 'inStock'];

/** POST body / one Excel row: the required specs, plus optional extras (defaults are applied by the service). */
export const laptopCreateSchema = z.object(
  Object.fromEntries(Object.entries(shape).map(([key, schema]) => [key, OPTIONAL.includes(key) ? schema.optional() : schema])),
);

/** PATCH body: any subset of fields (e.g. just the price). Unknown keys are dropped. */
export const laptopPatchSchema = z
  .object(shape)
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Send at least one field to change');

export const LAPTOP_DEFAULTS = Object.freeze({
  type: 'Laptop',
  screen: '',
  battery: '',
  weight: '',
  photosUrl: '',
  gpu: '',
  notes: '',
  description: '',
  os: '',
  color: '',
  ports: '',
  warranty: '',
  images: [],
  inStock: true,
});
