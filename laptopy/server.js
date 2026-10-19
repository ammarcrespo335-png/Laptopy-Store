import { createApp } from './src/app.js';
import { loadConfig } from './src/config/index.js';
import { logger } from './src/utils/logger.js';

const config = loadConfig();
const { app, container } = await createApp({ config });
const advisor = container.services.advisor;

const server = app.listen(config.port, () => {
  logger.info(`Laptopy is running on http://localhost:${config.port}  (${config.env})`);
  logger.info(`Admin account: ${config.adminEmail}`);
  logger.info(config.googleClientId ? 'Google sign-in: enabled' : 'Google sign-in: DISABLED (set GOOGLE_CLIENT_ID)');
  logger.info(advisor.aiEnabled ? `Robin AI: enabled (${config.anthropicModel})` : 'Robin AI: using built-in advisor (set ANTHROPIC_API_KEY for full AI)');
  if (config.devAuth) logger.warn('DEV_AUTH is ON – anyone can sign in as any e-mail. Local testing only!');
});

function shutdown(signal) {
  logger.info(`${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
