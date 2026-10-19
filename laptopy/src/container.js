import { loadStoreInfo } from './config/store.js';
import { createAdvisorController } from './controllers/advisor.controller.js';
import { createAuthController } from './controllers/auth.controller.js';
import { createConfigController } from './controllers/config.controller.js';
import { createLaptopImagesController } from './controllers/laptop-images.controller.js';
import { createLaptopImportController } from './controllers/laptop-import.controller.js';
import { createLaptopsController } from './controllers/laptops.controller.js';
import { createRateLimiters } from './middleware/rate-limit.middleware.js';
import { AnthropicProvider } from './providers/anthropic.provider.js';
import { LaptopRepository } from './repositories/laptop.repository.js';
import { AdvisorService } from './services/advisor.service.js';
import { createGoogleAuthService } from './services/google-auth.service.js';
import { LaptopImageService } from './services/laptop-image.service.js';
import { LaptopImportService } from './services/laptop-import.service.js';
import { LaptopService } from './services/laptop.service.js';
import { LocalAdvisor } from './services/local-advisor.service.js';
import { createSessionService } from './services/session.service.js';

/**
 * Composition root: the only place that creates and wires the app's building blocks.
 * Anything with side effects (storage, Google, AI) can be replaced through `overrides`,
 * which is how the automated tests run without network access.
 */
export async function createContainer({ config, overrides = {} }) {
  const store = await loadStoreInfo(config.storeConfigPath);

  const repository =
    overrides.repository ?? (await new LaptopRepository({ dataDir: config.dataDir, seedPath: config.seedPath }).init());

  const provider =
    overrides.provider !== undefined
      ? overrides.provider
      : config.anthropicApiKey
        ? new AnthropicProvider({ apiKey: config.anthropicApiKey, model: config.anthropicModel })
        : null;

  const googleAuth =
    overrides.googleAuth !== undefined
      ? overrides.googleAuth
      : config.googleClientId
        ? createGoogleAuthService(config.googleClientId)
        : null;

  const images = await new LaptopImageService({ repository, uploadsDir: config.uploadsDir }).init();
  const laptops = new LaptopService(repository, images);
  const importer = new LaptopImportService({ repository, images });
  const advisor = new AdvisorService({
    provider,
    local: new LocalAdvisor({ currency: store.currency }),
    storeName: store.name,
    currency: store.currency,
  });
  const sessions = createSessionService(config);

  return {
    config,
    store,
    services: { laptops, advisor, sessions },
    limiters: createRateLimiters(overrides.rateLimits),
    controllers: {
      config: createConfigController({ config, store, advisor }),
      auth: createAuthController({ config, sessions, googleAuth }),
      laptops: createLaptopsController({ laptops }),
      images: createLaptopImagesController({ images }),
      importer: createLaptopImportController({ importer }),
      advisor: createAdvisorController({ advisor, laptops }),
    },
  };
}
