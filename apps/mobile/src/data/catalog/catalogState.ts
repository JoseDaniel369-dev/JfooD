/**
 * Which database connections have the catalog attached. The repositories ask
 * this before reading `catalog.*`, so when the catalog could not be loaded (or
 * in a test without one) they simply search the person's own foods, exactly as
 * the app did before the big catalog existed.
 */
const attached = new WeakSet<object>();

export function markCatalogAttached(database: object): void {
  attached.add(database);
}

export function markCatalogDetached(database: object): void {
  attached.delete(database);
}

export function isCatalogAttached(database: object): boolean {
  return attached.has(database);
}
