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
    const { code, message } = describeClientError(statusCode, error);

    return reply.status(statusCode).send({ error: { code, message } });
  });

  return app;
}

/** Spanish messages for the errors Fastify and its plugins raise (the app shows them as they are). */
function describeClientError(
  statusCode: number,
  error: unknown,
): { code: string; message: string } {
  switch (statusCode) {
    case 429:
      return {
        code: 'RATE_LIMITED',
        message: 'Demasiadas peticiones seguidas. Espera un minuto e inténtalo de nuevo.',
      };
    case 413:
      return {
        code: 'INVALID_REQUEST',
        message: 'La imagen es demasiado grande. Prueba con una foto más pequeña.',
      };
    case 415:
      return { code: 'INVALID_REQUEST', message: 'Formato de petición no admitido.' };
    case 500:
      return { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' };
    default:
      return {
        code: 'INVALID_REQUEST',
        message: error instanceof Error ? error.message : 'Solicitud no válida',
      };
  }
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
