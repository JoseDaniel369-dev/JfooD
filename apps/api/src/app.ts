import Fastify from 'fastify';

import type { ApiEnvironment } from './config/env.js';
import { recognizeRoute } from './features/recognition/route.js';

interface BuildAppOptions {
  logger?: boolean;
  environment?: ApiEnvironment;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
    bodyLimit: 10 * 1024 * 1024,
  });
  const environment = options.environment;

  app.get('/health', async () => ({
    service: 'jfood-api',
    status: 'ok',
  }));

  if (environment) {
    recognizeRoute(app, environment);
  }

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
