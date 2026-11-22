import { foodRecognitionSchema } from '@jfood/core';

import { getApiBaseUrl } from '@/config/api';

import type { RecognitionResult } from '../types';

export interface RecognitionError {
  code: string;
  message: string;
}

/**
 * Render's free tier sleeps after inactivity and takes up to ~50 s to wake up,
 * on top of the few seconds Gemini needs, so the wait must be generous.
 */
const RECOGNIZE_TIMEOUT_MS = 75_000;
const WAKE_UP_TIMEOUT_MS = 70_000;

/**
 * Pings the server so it is already awake when the person takes the photo.
 * Fire and forget: it never throws and never blocks the screen.
 */
export function warmUpServer(): void {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WAKE_UP_TIMEOUT_MS);

  fetch(`${getApiBaseUrl()}/health`, { signal: controller.signal })
    .catch(() => undefined)
    .finally(() => clearTimeout(timeoutId));
}

/** Identifies the foods in a photo (data URI or base64). */
export function recognizeImage(
  imageBase64: string,
  signal?: AbortSignal,
): Promise<RecognitionResult> {
  return postRecognition('/recognize', { image: imageBase64 }, signal);
}

/** Extracts the foods mentioned in a free-text description of a meal. */
export function recognizeText(
  text: string,
  signal?: AbortSignal,
): Promise<RecognitionResult> {
  return postRecognition('/parse-meal', { text }, signal);
}

/**
 * The shared app token (EXPO_PUBLIC_APP_TOKEN, matching APP_TOKEN on the API)
 * is not a secret — it ships inside the APK — but it keeps casual traffic out.
 */
export function buildHeaders(
  token: string | undefined = process.env.EXPO_PUBLIC_APP_TOKEN,
): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['x-app-token'] = token;
  }
  return headers;
}

async function postRecognition(
  path: string,
  payload: Record<string, string>,
  externalSignal?: AbortSignal,
): Promise<RecognitionResult> {
  const controller = new AbortController();
  // The caller (e.g. a screen that is closing) can cancel the request too.
  const abortFromCaller = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  externalSignal?.addEventListener('abort', abortFromCaller);
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, RECOGNIZE_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: buildHeaders(),
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
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
}
