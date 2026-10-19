import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'laptopy_session';
const SESSION_DAYS = 7;

/** The user fields that are safe to send to the browser. */
export const publicUser = (u) => ({ email: u.email, name: u.name, picture: u.picture, isAdmin: u.isAdmin });

/**
 * Cookie session built on a signed JWT.
 * - The cookie is HttpOnly (JavaScript cannot read it), SameSite=Lax and Secure in production.
 * - The admin flag is NEVER stored in the token: it is recomputed from the verified e-mail on every
 *   request, so changing ADMIN_EMAIL takes effect immediately.
 */
export function createSessionService(config) {
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/' };

  const toUser = (claims) => ({
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    picture: claims.picture ?? '',
    isAdmin: String(claims.email).toLowerCase() === config.adminEmail,
  });

  return {
    isAdminEmail: (email) => String(email).toLowerCase() === config.adminEmail,

    /** Signs the user in by setting the session cookie. */
    issue(res, identity) {
      const token = jwt.sign(
        { sub: identity.sub, email: identity.email, name: identity.name, picture: identity.picture },
        config.sessionSecret,
        { algorithm: 'HS256', expiresIn: `${SESSION_DAYS}d` },
      );
      res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
    },

    clear(res) {
      res.clearCookie(SESSION_COOKIE, cookieOptions);
    },

    /** The signed-in user for this request, or null (missing, expired or tampered cookie). */
    read(req) {
      const token = req.cookies?.[SESSION_COOKIE];
      if (!token) return null;
      try {
        return toUser(jwt.verify(token, config.sessionSecret, { algorithms: ['HS256'] }));
      } catch {
        return null;
      }
    },
  };
}
