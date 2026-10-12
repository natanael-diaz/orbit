import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function fixture({ legacy = false } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_misty_mojo.sql', import.meta.url), 'utf8'));
  if (legacy) {
    sqlite.exec(`INSERT INTO runs VALUES('old-run','account','legacy','import','2026-01-01','{"posts":[]}',NULL);
      INSERT INTO outcomes VALUES('old-note','2026-01-01','{"account":"old"}');
      INSERT INTO ledger VALUES('old-charge','x',0.123456,'2026-01-01','historical');`);
  }
  sqlite.exec(
    readFileSync(new URL('../drizzle/0001_known_northstar.sql', import.meta.url), 'utf8'),
  );
  function prepare(sql) {
    const statement = sqlite.prepare(sql);
    let args = [];
    const wrapper = {
      bind(...values) {
        args = values;
        return wrapper;
      },
      execute() {
        const results = statement.columns().length
          ? statement.all(...args).map((row) => ({ ...row }))
          : [];
        const meta = statement.columns().length ? {} : statement.run(...args);
        return { results, meta, success: true };
      },
      async all() {
        return wrapper.execute();
      },
      async first() {
        return wrapper.execute().results[0] || null;
      },
      async run() {
        return wrapper.execute();
      },
    };
    return wrapper;
  }
  const database = {
    prepare,
    async batch(queries) {
      sqlite.exec('BEGIN');
      try {
        const result = queries.map((query) => query.execute());
        sqlite.exec('COMMIT');
        return result;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return { database, sqlite };
}
