/** Public settings the browser needs to boot. Never includes secrets or the admin e-mail. */
export function createConfigController({ config, store, advisor }) {
  return {
    get(_req, res) {
      res.json({ store, googleClientId: config.googleClientId, devAuth: config.devAuth, aiEnabled: advisor.aiEnabled });
    },
  };
}
