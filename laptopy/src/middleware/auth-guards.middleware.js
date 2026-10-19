import { forbidden, unauthorized } from '../utils/http-error.js';

export function requireUser(req, _res, next) {
  next(req.user ? undefined : unauthorized());
}

/** Only the configured admin e-mail gets through. Everyone else: 401 (signed out) or 403 (other account). */
export function requireAdmin(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (!req.user.isAdmin) return next(forbidden('This area is for the store admin only.'));
  next();
}
