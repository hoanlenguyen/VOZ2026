import { DatabaseSync } from 'node:sqlite'
import type { NewsDatabase, NewsStatement } from './database.ts'

/** Development/test adapter only; the production bundle removes the importing dev branch. */
export function openLocalNewsDatabase(path: string): NewsDatabase {
  const sqlite = new DatabaseSync(path)
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;')
  return {
    exec: async sql => { sqlite.exec(sql) },
    prepare(sql) {
      let values: (string | number | null)[] = []
      const statement: NewsStatement = {
        bind(...args) { values = args; return statement },
        first: async <T>() => (sqlite.prepare(sql).get(...values) as T | undefined) ?? null,
        all: async <T>() => ({ results: sqlite.prepare(sql).all(...values) as T[] }),
        run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }),
      }
      return statement
    },
  }
}
