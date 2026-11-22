import assert from 'node:assert/strict';
import { test } from 'node:test';

import { runInTransaction } from '../../src/data/sqlite/utils/transaction';
import { createMigratedDatabase } from '../helpers/sqliteAdapter';

test('overlapping transactions run one after another instead of rolling each other back', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();
  const order: string[] = [];

  const slow = runInTransaction(sqlite, async () => {
    order.push('slow:start');
    await sqlite.runAsync("INSERT INTO app_settings (key, value) VALUES ('a', '1')");
    await new Promise((resolve) => setTimeout(resolve, 20));
    order.push('slow:end');
  });
  const fast = runInTransaction(sqlite, async () => {
    order.push('fast:start');
    await sqlite.runAsync("INSERT INTO app_settings (key, value) VALUES ('b', '2')");
    order.push('fast:end');
  });

  await Promise.all([slow, fast]);

  assert.deepEqual(order, ['slow:start', 'slow:end', 'fast:start', 'fast:end']);
  const rows = await sqlite.getAllAsync<{ key: string }>(
    "SELECT key FROM app_settings WHERE key IN ('a', 'b') ORDER BY key",
  );
  assert.deepEqual(rows.map((row) => row.key), ['a', 'b']);
});

test('a failed transaction rolls back and does not block the next one', async () => {
  const sqlite = (await createMigratedDatabase()).asSqlite();

  const failing = runInTransaction(sqlite, async () => {
    await sqlite.runAsync("INSERT INTO app_settings (key, value) VALUES ('x', '1')");
    throw new Error('boom');
  });
  const next = runInTransaction(sqlite, async () => {
    await sqlite.runAsync("INSERT INTO app_settings (key, value) VALUES ('y', '2')");
  });

  await assert.rejects(failing, /boom/);
  await next;

  const rows = await sqlite.getAllAsync<{ key: string }>(
    "SELECT key FROM app_settings WHERE key IN ('x', 'y')",
  );
  assert.deepEqual(rows.map((row) => row.key), ['y']);
});
