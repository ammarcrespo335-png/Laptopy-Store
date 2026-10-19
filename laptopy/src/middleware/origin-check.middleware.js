import { forbidden } from '../utils/http-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence-in-depth (on top of SameSite=Lax cookies):
 * browsers always send an Origin header on cross-site POST/PUT/PATCH/DELETE,
 * so a state-changing request from a foreign origin is rejected.
 */
export function originCheck(config) {
  const allowed = new Set(config.allowedOrigins);
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next(); // non-browser client (curl, server-to-server)
    try {
      const url = new URL(origin);
      if (url.host === req.get('host') || allowed.has(url.origin)) return next();
    } catch {
      /* fall through */
    }
    next(forbidden('Cross-origin request blocked.'));
  };
}
