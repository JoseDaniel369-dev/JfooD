/** Escapes the characters that mean something inside a LIKE pattern (use with ESCAPE '\'). */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** `%word%`: matches anywhere in the text. */
export function containsPattern(token: string): string {
  return `%${escapeLike(token)}%`;
}
