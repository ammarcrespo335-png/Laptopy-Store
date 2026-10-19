import { publicUser } from '../services/session.service.js';
import { forbidden, notFound, unauthorized, unavailable } from '../utils/http-error.js';
import { logger } from '../utils/logger.js';
import { devLoginSchema, googleLoginSchema } from '../validators/auth.schema.js';

export function createAuthController({ config, sessions, googleAuth }) {
  return {
    me(req, res) {
      res.json({ user: req.user ? publicUser(req.user) : null });
    },

    /** Exchanges a Google ID token ("Sign in with Google") for our own session cookie. */
    async google(req, res) {
      if (!googleAuth) throw unavailable('Google sign-in is not configured on the server.', 'google_not_configured');
      const { credential } = googleLoginSchema.parse(req.body);

      let identity;
      try {
        identity = await googleAuth.verify(credential);
      } catch (err) {
        logger.warn('Google token rejected:', err?.message ?? err);
        throw unauthorized('Google sign-in failed. Please try again.');
      }
      if (!identity.emailVerified) throw forbidden('Your Google e-mail is not verified.');

      sessions.issue(res, identity);
      res.json({ user: publicUser({ ...identity, isAdmin: sessions.isAdminEmail(identity.email) }) });
    },

    logout(_req, res) {
      sessions.clear(res);
      res.status(204).end();
    },

    /** Local testing only (DEV_AUTH=true, never in production): sign in as any e-mail without Google. */
    async devLogin(req, res) {
      if (!config.devAuth) throw notFound();
      const { email } = devLoginSchema.parse(req.body);
      const identity = { sub: `dev:${email}`, email, name: email.split('@')[0], picture: '' };
      sessions.issue(res, identity);
      res.json({ user: publicUser({ ...identity, isAdmin: sessions.isAdminEmail(email) }) });
    },
  };
}
