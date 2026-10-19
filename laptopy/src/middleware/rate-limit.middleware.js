import rateLimit from 'express-rate-limit';

const make = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: { code: 'rate_limited', message } }),
  });

/** Per-IP limits. Chat is the strictest because every call can cost money. */
export function createRateLimiters(overrides = {}) {
  const k = overrides.multiplier ?? 1;
  return {
    api: make({ windowMs: 60_000, limit: 240 * k, message: 'Too many requests. Please slow down.' }),
    auth: make({ windowMs: 15 * 60_000, limit: 30 * k, message: 'Too many sign-in attempts. Try again later.' }),
    chat: make({ windowMs: 60_000, limit: 15 * k, message: 'You are sending messages too fast. Wait a moment.' }),
  };
}
