import type { FastifyInstance } from 'fastify';

import type { ApiEnvironment } from '../../config/env.js';
import { GeminiError, recognizeFood } from './service.js';

interface RecognizeBody {
  image: string;
}

interface RecognizeReply {
  foods: Array<{
    name: string;
    estimatedGrams: number;
    confidence: number | null;
  }>;
  warnings: string[];
}

export function recognizeRoute(
  app: FastifyInstance,
  environment: ApiEnvironment,
): void {
  app.post<{
    Body: RecognizeBody;
    Reply: RecognizeReply | { error: { code: string; message: string } };
  }>('/recognize', async (request, reply) => {
    if (!environment.GEMINI_API_KEY) {
      return reply.status(503).send({
        error: {
          code: 'GEMINI_NOT_CONFIGURED',
          message: 'El reconocimiento no está configurado en este servidor.',
        },
      });
    }

    const image = request.body?.image;
    if (typeof image !== 'string' || image.trim() === '') {
      return reply.status(400).send({
        error: {
          code: 'INVALID_IMAGE',
          message: 'Debes enviar una imagen codificada en base64.',
        },
      });
    }

    try {
      const result = await recognizeFood({
        apiKey: environment.GEMINI_API_KEY,
        model: environment.GEMINI_MODEL,
        imageBase64: image,
      });

      return reply.send(result);
    } catch (error) {
      if (error instanceof GeminiError) {
        request.log.warn({ err: error }, 'Gemini recognition failed');
        return reply.status(502).send({
          error: {
            code: 'RECOGNITION_FAILED',
            message: 'No se ha podido reconocer la comida. Inténtalo de nuevo.',
          },
        });
      }

      throw error;
    }
  });
}
