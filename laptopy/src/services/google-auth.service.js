import { OAuth2Client } from 'google-auth-library';

/**
 * Verifies Google ID tokens ("Sign in with Google") on the server.
 * The token's signature, expiry and audience (our client id) are all checked by google-auth-library.
 */
export function createGoogleAuthService(clientId) {
  const client = new OAuth2Client(clientId);
  return {
    async verify(idToken) {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      const p = ticket.getPayload();
      if (!p?.sub || !p.email) throw new Error('Google token has no identity');
      return {
        sub: p.sub,
        email: p.email,
        emailVerified: p.email_verified === true,
        name: p.name || p.email,
        picture: p.picture || '',
      };
    },
  };
}
