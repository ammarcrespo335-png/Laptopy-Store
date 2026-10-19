import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { loadConfig } from './config/index.js';
import { createContainer } from './container.js';
import { attachUser } from './middleware/session.middleware.js';
import { errorHandler } from './middleware/error-handler.middleware.js';
import { originCheck } from './middleware/origin-check.middleware.js';
import { createApiRouter } from './routes/index.js';

const GOOGLE = 'https://accounts.google.com/gsi/';

/** Builds the Express application (no network listening here – see server.js). */
export async function createApp({ config, overrides = {} }) {
  const container = await createContainer({ config, overrides });
  const { services, controllers, limiters } = container;

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", `${GOOGLE}client`],
          'style-src': ["'self'", 'https://fonts.googleapis.com', `${GOOGLE}style`],
          'style-src-attr': ["'unsafe-inline'"], // inline style="" attributes (CSS variables for animations)
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:', 'https:'],
          'connect-src': ["'self'", GOOGLE],
          'frame-src': [GOOGLE],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'upgrade-insecure-requests': config.isProd ? [] : null,
        },
      },
      // Google's sign-in popup needs to talk back to this window.
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }),
  );

  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(attachUser(services.sessions));
  app.use(originCheck(config));

  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.use('/api', limiters.api, createApiRouter({ controllers, limiters }));

  const staticOptions = { maxAge: config.isProd ? '1h' : 0, etag: true };
  app.use('/uploads', express.static(config.uploadsDir, { maxAge: '7d', index: false, dotfiles: 'deny' }));
  app.use('/shared', express.static(config.sharedDir, staticOptions));
  app.use(express.static(config.publicDir, staticOptions));

  app.use(errorHandler(config.isProd));
  return { app, container };
}

/**
 * Vercel entrypoint: build the app once per warm instance, then reuse it.
 * server.js (local / long-running servers) keeps using createApp + listen.
 */
let appPromise;

export default async function handler(req, res) {
  appPromise ??= createApp({ config: loadConfig() }).then((r) => r.app);
  const app = await appPromise;
  return app(req, res);
}
