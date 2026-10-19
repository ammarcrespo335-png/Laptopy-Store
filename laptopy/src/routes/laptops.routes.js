import express, { Router } from 'express';
import { requireAdmin } from '../middleware/auth-guards.middleware.js';

/** Binary uploads (Excel file / photo) arrive as the raw request body. */
const rawFile = express.raw({ type: () => true, limit: '6mb' });

export function laptopsRoutes({ laptops, images, importer }) {
  const router = Router();

  // ---- public ----
  router.get('/', laptops.list);

  // ---- admin only (declared before '/:id' so "template.xlsx" is not read as an id) ----
  router.get('/template.xlsx', requireAdmin, importer.template);
  router.post('/import', requireAdmin, rawFile, importer.importFile);

  router.get('/:id', laptops.get);
  router.post('/', requireAdmin, laptops.create);
  router.patch('/:id', requireAdmin, laptops.patch);
  router.delete('/:id', requireAdmin, laptops.remove);

  router.post('/:id/images', requireAdmin, rawFile, images.upload);
  router.delete('/:id/images/:index', requireAdmin, images.remove);

  return router;
}
