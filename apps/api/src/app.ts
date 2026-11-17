import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';

import type { ApiEnvironment } from './config/env.js';
import { recognizeRoute } from './features/recognition/route.js';

interface BuildAppOptions {
  logger?: boolean;
  environment?: ApiEnvironment;
  /** Proxy hops to trust for the client IP (see resolveTrustProxyHops). */
  trustProxyHops?: number;
}

export function buildApp(options: BuildAppOptions = {}) {
  const trustedHops = options.trustProxyHops ?? 0;
  const app = Fastify({
    logger: options.logger ?? true,
    bodyLimit: 10 * 1024 * 1024,
    // Trust only the last N proxy hops (not `true`), so a client cannot forge
    // X-Forwarded-For to dodge the rate limit. Hop 0 is the socket peer.
    trustProxy: trustedHops > 0 ? (_address, hop) => hop < trustedHops : false,
  });
  const environment = options.environment;

  app.register(rateLimit, {
    max: 10,
    timeWindow: '1 minute',
    allowList: (request) => (request.url ?? '').split('?')[0] === '/health',
  });

  // Routes MUST be registered in a plugin that loads after the rate limiter:
  // @fastify/rate-limit only protects routes added once it has been loaded, so
  // declaring them synchronously on the root instance left them unprotected.
  app.register(async (routes) => {
    routes.get('/health', async () => ({
      service: 'jfood-api',
      status: 'ok',
    }));

    if (environment) {
      recognizeRoute(routes, environment);
    }
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Ruta no encontrada',
      },
    });
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    request.log.error({ err: error }, 'Request failed');

    const statusCode = getClientErrorStatus(error);
    const message =
      statusCode === 500
        ? 'Error interno del servidor'
        : error instanceof Error
          ? error.message
          : 'Solicitud no válida';

    return reply.status(statusCode).send({
      error: {
        code: statusCode === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST',
        message,
      },
    });
  });

  return app;
}

function getClientErrorStatus(error: unknown): number {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
    return 500;
  }

  const statusCode = error.statusCode;
  return typeof statusCode === 'number' &&
    statusCode >= 400 &&
    statusCode < 500
    ? statusCode
    : 500;
}
