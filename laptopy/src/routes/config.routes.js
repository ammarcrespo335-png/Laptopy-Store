import { Router } from 'express';

export function configRoutes(controller) {
  const router = Router();
  router.get('/config', controller.get);
  return router;
}
