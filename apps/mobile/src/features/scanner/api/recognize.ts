import { foodRecognitionSchema } from '@jfood/core';

import { getApiBaseUrl } from '@/config/api';

import type { RecognitionResult } from '../types';

export interface RecognitionError {
  code: string;
  message: string;
}

const RECOGNIZE_TIMEOUT_MS = 40_000;

export async function recognizeImage(
  imageBase64: string,
): Promise<RecognitionResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, RECOGNIZE_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiBaseUrl()}/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 }),
      signal: controller.signal,
    });

    const json: unknown = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error =
        typeof json === 'object' &&
        json !== null &&
        'error' in json &&
        typeof json.error === 'object' &&
        json.error !== null &&
        'message' in json.error &&
        typeof json.error.message === 'string'
          ? json.error.message
          : 'No se ha podido analizar la imagen.';

      throw new Error(error);
    }

    // The shared contract is strict: it rejects any nutritional field, so a
    // misbehaving server (or model) can never inject nutrients into the app.
    const parsed = foodRecognitionSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error('Respuesta inesperada del servidor.');
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('El análisis ha tardado demasiado. Inténtalo de nuevo.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
