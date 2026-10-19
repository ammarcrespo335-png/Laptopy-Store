import { Router } from 'express';
import { apiNotFound } from '../middleware/error-handler.middleware.js';
import { advisorRoutes } from './advisor.routes.js';
import { authRoutes } from './auth.routes.js';
import { configRoutes } from './config.routes.js';
import { laptopsRoutes } from './laptops.routes.js';

/** Everything under /api. */
export function createApiRouter({ controllers, limiters }) {
  const router = Router();
  router.use(configRoutes(controllers.config));
  router.use('/auth', authRoutes(controllers.auth, limiters.auth));
  router.use('/laptops', laptopsRoutes({ laptops: controllers.laptops, images: controllers.images, importer: controllers.importer }));
  router.use(advisorRoutes(controllers.advisor, limiters.chat));
  router.use(apiNotFound);
  return router;
}
