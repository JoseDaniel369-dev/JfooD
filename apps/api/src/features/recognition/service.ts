import {
  foodRecognitionSchema,
  type FoodRecognition,
} from '@jfood/core';

export interface RecognitionOptions {
  apiKey: string;
  model: string;
  imageBase64: string;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export async function recognizeFood(
  options: RecognitionOptions,
): Promise<FoodRecognition> {
  const { apiKey, model, imageBase64 } = options;

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        // The key travels in a header, never in the URL (URLs end up in logs).
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: buildPrompt(),
                },
                {
                  inlineData: {
                    mimeType: detectMimeType(imageBase64),
                    data: stripDataUri(imageBase64),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch (error) {
    throw new GeminiError('Gemini API request failed', error);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown');
    throw new GeminiError(
      `Gemini responded with ${response.status}: ${body.slice(0, 200)}`,
    );
  }

  const json: unknown = await response.json();
  const text = extractText(json);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFences(text));
  } catch {
    throw new GeminiError('Gemini response is not valid JSON');
  }

  const result = foodRecognitionSchema.safeParse(parsed);
  if (!result.success) {
    throw new GeminiError('Gemini response does not match recognition schema');
  }

  return result.data;
}

function buildPrompt(): string {
  return [
    'Eres un asistente nutricional. Analiza la imagen de comida y devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta:',
    '{"foods":[{"name":"string","estimatedGrams":number,"confidence":number}],"warnings":["string"]}.',
    '',
    'Reglas estrictas:',
    '- Devuelve SOLO el JSON. Sin markdown, sin bloques de código, sin explicaciones.',
    '- "foods" es un array con cada alimento reconocido individualmente.',
    '- "name" es el nombre común del alimento en español, sin marcas comerciales.',
    '- "estimatedGrams" es una estimación positiva del peso total de ese alimento en gramos (máximo 10000).',
    '- "confidence" es un número entre 0 y 1 que indica tu confianza en el reconocimiento.',
    '- No incluyas valores nutricionales (calorías, proteínas, carbohidratos, grasas).',
    '- Si no reconoces ningún alimento, devuelve foods vacío y al menos un warning explicando por qué.',
  ].join('\n');
}

function stripDataUri(base64: string): string {
  const match = base64.match(/^data:[^;]+;base64,(.+)$/);
  return match?.[1] ?? base64;
}

function detectMimeType(base64: string): string {
  const match = base64.match(/^data:([^;]+);base64,/);
  return match?.[1] ?? 'image/jpeg';
}

function extractText(json: unknown): string {
  if (
    typeof json === 'object' &&
    json !== null &&
    'candidates' in json &&
    Array.isArray(json.candidates) &&
    json.candidates.length > 0
  ) {
    const candidate = json.candidates[0];
    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      'content' in candidate &&
      typeof candidate.content === 'object' &&
      candidate.content !== null &&
      'parts' in candidate.content &&
      Array.isArray(candidate.content.parts) &&
      candidate.content.parts.length > 0
    ) {
      // Some models return several parts (e.g. reasoning + answer): join the
      // answer text and ignore parts flagged as thoughts.
      const text = candidate.content.parts
        .filter(
          (part: unknown): part is { text: string } =>
            typeof part === 'object' &&
            part !== null &&
            'text' in part &&
            typeof part.text === 'string' &&
            !('thought' in part && part.thought === true),
        )
        .map((part: { text: string }) => part.text)
        .join('');

      if (text !== '') {
        return text;
      }
    }
  }

  if (typeof json === 'string') {
    return json;
  }

  throw new GeminiError('Unexpected Gemini response structure');
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match?.[1] ?? trimmed;
}
