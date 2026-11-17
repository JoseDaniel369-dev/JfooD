import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildApp } from './app.js';
import { loadEnvironment, resolveTrustProxyHops } from './config/env.js';

const environmentPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(environmentPath)) {
  process.loadEnvFile(environmentPath);
}

const environment = loadEnvironment();
const app = buildApp({
  environment,
  trustProxyHops: resolveTrustProxyHops(environment),
});

try {
  await app.listen({
    host: environment.API_HOST,
    port: environment.PORT ?? environment.API_PORT,
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
