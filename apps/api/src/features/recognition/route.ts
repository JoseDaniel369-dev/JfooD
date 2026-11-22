import { timingSafeEqual } from 'node:crypto';

import { parseMealRequestSchema, recognizeRequestSchema } from '@jfood/core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ApiEnvironment } from '../../config/env.js';
import { createDailyLimiter, createKeyedDailyLimiter } from './dailyLimit.js';
import { GeminiError, parseMealText, recognizeFood } from './service.js';

interface RecognizeReply {
  foods: Array<{
    name: string;
    estimatedGrams: number;
    confidence: number | null;
  }>;
  warnings: string[];
}

type ErrorReply = { error: { code: string; message: string } };

function sameToken(received: unknown, expected: string): boolean {
  if (typeof received !== 'string') {
    return false;
  }
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function recognizeRoute(
  app: FastifyInstance,
  environment: ApiEnvironment,
): void {
  // Photo and text analyses share one daily budget of Gemini calls, and each
  // client IP also has its own, so one client cannot drain the shared one.
  const dailyLimiter = createDailyLimiter(environment.RECOGNIZE_DAILY_LIMIT);
  const perClientLimiter = createKeyedDailyLimiter(
    environment.RECOGNIZE_DAILY_LIMIT_PER_IP,
  );

  /** Rejects calls without the app token (when one is configured). */
  async function requireAppToken(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply | void> {
    const expected = environment.APP_TOKEN;
    if (expected && !sameToken(request.headers['x-app-token'], expected)) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'La aplicación no está autorizada para usar este servidor.',
        },
      } satisfies ErrorReply);
    }
  }

  /**
   * Reserves one call in the client's budget and the shared one. Returns a
   * function that gives both back when the call produced no result, or null
   * (after sending 429) when a budget is exhausted.
   */
  function reserve(
    request: FastifyRequest,
    reply: FastifyReply,
  ): (() => void) | null {
    const client = request.ip;

    if (!perClientLimiter.tryConsume(client)) {
      void reply.status(429).send({
        error: {
          code: 'DAILY_LIMIT_REACHED',
          message:
            'Has alcanzado tu límite diario de análisis. Inténtalo mañana.',
        },
      } satisfies ErrorReply);
      return null;
    }

    if (!dailyLimiter.tryConsume()) {
      perClientLimiter.refund(client);
      void reply.status(429).send({
        error: {
          code: 'DAILY_LIMIT_REACHED',
          message:
            'Se ha alcanzado el límite diario de análisis. Inténtalo mañana.',
        },
      } satisfies ErrorReply);
      return null;
    }

    return () => {
      dailyLimiter.refund();
      perClientLimiter.refund(client);
    };
  }

  /** Maps a failed Gemini call to the reply; the budget is given back. */
  function replyGeminiFailure(
    request: FastifyRequest,
    reply: FastifyReply,
    error: GeminiError,
    failureMessage: string,
  ) {
    request.log.warn({ err: error }, 'Gemini request failed');

    if (error.isOverloaded) {
      return reply.status(503).send({
        error: {
          code: 'UPSTREAM_BUSY',
          message:
            'El servicio de análisis está saturado. Prueba de nuevo en unos minutos.',
        },
      } satisfies ErrorReply);
    }

    return reply.status(502).send({
      error: { code: 'RECOGNITION_FAILED', message: failureMessage },
    } satisfies ErrorReply);
  }

  function notConfigured(reply: FastifyReply) {
    return reply.status(503).send({
      error: {
        code: 'GEMINI_NOT_CONFIGURED',
        message: 'El reconocimiento no está configurado en este servidor.',
      },
    } satisfies ErrorReply);
  }

  app.post<{ Reply: RecognizeReply | ErrorReply }>(
    '/parse-meal',
    { onRequest: requireAppToken },
    async (request, reply) => {
      if (!environment.GEMINI_API_KEY) {
        return notConfigured(reply);
      }

      const body = parseMealRequestSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_TEXT',
            message:
              'Escribe entre 2 y 500 caracteres describiendo lo que has comido.',
          },
        });
      }

      const release = reserve(request, reply);
      if (!release) {
        return reply;
      }

      try {
        return reply.send(
          await parseMealText({
            apiKey: environment.GEMINI_API_KEY,
            model: environment.GEMINI_MODEL,
            text: body.data.text,
          }),
        );
      } catch (error) {
        // No result was produced, so it must not count against the budgets.
        release();
        if (error instanceof GeminiError) {
          return replyGeminiFailure(
            request,
            reply,
            error,
            'No se ha podido interpretar el texto. Inténtalo de nuevo.',
          );
        }

        throw error;
      }
    },
  );

  app.post<{ Reply: RecognizeReply | ErrorReply }>(
    '/recognize',
    { onRequest: requireAppToken },
    async (request, reply) => {
      if (!environment.GEMINI_API_KEY) {
        return notConfigured(reply);
      }

      const body = recognizeRequestSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_IMAGE',
            message:
              'Debes enviar una imagen JPEG, PNG o WebP codificada en base64.',
          },
        });
      }

      const release = reserve(request, reply);
      if (!release) {
        return reply;
      }

      try {
        const result = await recognizeFood({
          apiKey: environment.GEMINI_API_KEY,
          model: environment.GEMINI_MODEL,
          imageBase64: body.data.image,
        });

        return reply.send(result);
      } catch (error) {
        release();
        if (error instanceof GeminiError) {
          return replyGeminiFailure(
            request,
            reply,
            error,
            'No se ha podido reconocer la comida. Inténtalo de nuevo.',
          );
        }

        throw error;
      }
    },
  );
}
