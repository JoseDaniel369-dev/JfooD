import { foodRecognitionSchema } from '@jfood/core';

import { getApiBaseUrl } from '@/config/api';

import type { RecognitionResult } from '../types';

export interface RecognitionError {
  code: string;
  message: string;
}

const RECOGNIZE_TIMEOUT_MS = 40_000;

/** Identifies the foods in a photo (data URI or base64). */
export function recognizeImage(imageBase64: string): Promise<RecognitionResult> {
  return postRecognition('/recognize', { image: imageBase64 });
}

/** Extracts the foods mentioned in a free-text description of a meal. */
export function recognizeText(text: string): Promise<RecognitionResult> {
  return postRecognition('/parse-meal', { text });
}

async function postRecognition(
  path: string,
  payload: Record<string, string>,
): Promise<RecognitionResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, RECOGNIZE_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
