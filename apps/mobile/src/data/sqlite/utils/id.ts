/**
 * Generates a locally-unique string id without adding a UUID dependency.
 * Good enough for local SQLite primary keys.
 */
export function generateId(): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2);
  return `${time}-${random}`;
}
