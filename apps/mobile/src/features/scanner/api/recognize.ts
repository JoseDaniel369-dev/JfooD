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

    if (
      typeof json !== 'object' ||
      json === null ||
      !('foods' in json) ||
      !Array.isArray(json.foods) ||
      !('warnings' in json) ||
      !Array.isArray(json.warnings)
    ) {
      throw new Error('Respuesta inesperada del servidor.');
    }

    return json as RecognitionResult;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('El análisis ha tardado demasiado. Inténtalo de nuevo.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
