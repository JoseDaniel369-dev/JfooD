import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * expo-sqlite's `withTransactionAsync` is just BEGIN … COMMIT on the one shared
 * connection, with no lock: a second transaction started meanwhile fails with
 * "cannot start a transaction within a transaction", and its ROLLBACK would
 * undo the first one's work. Any other write made meanwhile also becomes part of
 * the transaction and is undone if it fails.
 *
 * `runInTransaction` queues the transactions of one database so they run one
 * after another. A failed one does not stop the queue.
 *
 * Do not call it from inside another `runInTransaction` task of the same
 * database: the inner one would wait for the outer one forever.
 */
const queues = new WeakMap<object, Promise<unknown>>();

export function runInTransaction(
  database: SQLiteDatabase,
  task: () => Promise<void>,
): Promise<void> {
  const previous = queues.get(database) ?? Promise.resolve();
  const run = previous.then(
    () => database.withTransactionAsync(task),
    () => database.withTransactionAsync(task),
  );
  // Keep the queue alive whatever the outcome; the caller still sees the error.
  queues.set(
    database,
    run.catch(() => undefined),
  );
  return run;
}
