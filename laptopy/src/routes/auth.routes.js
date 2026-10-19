import { Router } from 'express';

export function authRoutes(controller, limiter) {
  const router = Router();
  router.get('/me', controller.me);
  router.post('/google', limiter, controller.google);
  router.post('/logout', controller.logout);
  router.post('/dev-login', limiter, controller.devLogin);
  return router;
}
