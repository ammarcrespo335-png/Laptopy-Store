import { ZodError } from 'zod';
import { HttpError, notFound } from '../utils/http-error.js';
import { logger } from '../utils/logger.js';

/** Unknown /api/* routes answer with JSON instead of the default HTML page. */
export const apiNotFound = (_req, _res, next) => next(notFound('Unknown API route.'));

const fieldErrors = (error) =>
  error.issues.map((i) => ({ field: i.path.join('.') || null, message: i.message }));

// eslint-disable-next-line no-unused-vars
export function errorHandler(isProd) {
  return (err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err instanceof ZodError) {
      return res.status(400).json({ error: { code: 'validation_failed', message: 'Please check the highlighted fields.', fields: fieldErrors(err) } });
    }
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'bad_json', message: 'The request body is not valid JSON.' } });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'too_large', message: 'The request is too large.' } });
    }

    logger.error(`${req.method} ${req.originalUrl}`, err);
    res.status(500).json({ error: { code: 'internal_error', message: isProd ? 'Something went wrong.' : String(err?.message ?? err) } });
  };
}
