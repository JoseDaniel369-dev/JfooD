/**
 * Puts the real API address in apps/mobile/eas.json (the `experimental` build).
 *
 *   npm run release:set-api-url -- https://tu-api.onrender.com
 *
 * The functions are exported so the checks can be tested without touching files.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The address as it must be written: HTTPS, no path, no trailing slash. Throws a Spanish message otherwise. */
export function normalizeApiUrl(raw: string): string {
  const text = raw.trim();
  if (text === '') {
    throw new Error('Falta la URL de la API. Ejemplo: https://jfood-api.onrender.com');
  }
  if (/TU_API/i.test(text)) {
    throw new Error('Escribe la URL real de tu API, no el valor de ejemplo.');
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`«${text}» no es una URL válida.`);
  }

  if (url.protocol !== 'https:') {
    throw new Error('La URL de la API debe empezar por https:// (Android bloquea el tráfico sin cifrar).');
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error('Usa solo el dominio, sin ruta ni parámetros: https://tu-api.onrender.com');
  }
  return url.origin;
}

/** The text of eas.json with the experimental build pointing at `apiUrl`. */
export function applyApiUrl(easJson: string, apiUrl: string): string {
  const url = normalizeApiUrl(apiUrl);
  const config = JSON.parse(easJson) as {
    build?: Record<string, { env?: Record<string, string> } | undefined>;
  };

  const experimental = config.build?.experimental;
  if (!experimental) {
    throw new Error('eas.json no tiene el perfil «experimental».');
  }
  experimental.env = { ...experimental.env, EXPO_PUBLIC_API_URL: url };

  return `${JSON.stringify(config, null, 2)}\n`;
}

function main(): void {
  const path = fileURLToPath(new URL('../eas.json', import.meta.url));
  try {
    const updated = applyApiUrl(readFileSync(path, 'utf8'), process.argv[2] ?? '');
    writeFileSync(path, updated);
    console.log('eas.json actualizado. Perfil «experimental» →', JSON.parse(updated).build.experimental.env.EXPO_PUBLIC_API_URL);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
