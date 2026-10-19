import fs from 'node:fs/promises';
import { z } from 'zod';

const storeSchema = z.object({
  name: z.string().min(1),
  slogan: z.string(),
  currency: z.string().min(1),
  phone: z.string(),
  whatsapp: z.string().regex(/^\d{8,15}$/, 'whatsapp must be digits only, including the country code'),
  address: z.string(),
  social: z.object({ instagram: z.url(), tiktok: z.url(), facebook: z.url() }),
});

/** Loads and validates config/store.json (name, contact details, social links...). */
export async function loadStoreInfo(filePath) {
  return storeSchema.parse(JSON.parse(await fs.readFile(filePath, 'utf8')));
}
