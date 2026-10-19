import { Router } from 'express';

export function advisorRoutes(controller, limiter) {
  const router = Router();
  router.post('/chat', limiter, controller.chat);
  router.post('/compare', limiter, controller.compare);
  return router;
}
