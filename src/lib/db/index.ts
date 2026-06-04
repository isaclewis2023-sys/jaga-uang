import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const globalDb = global as typeof global & { _db?: ReturnType<typeof drizzle> }

function createDb() {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!url) {
    throw new Error('TURSO_DATABASE_URL environment variable is required')
  }

  const client = createClient({ url, authToken })
  return drizzle(client, { schema })
}

export const db = globalDb._db ?? createDb()

if (process.env.NODE_ENV !== 'production') {
  globalDb._db = db
}

export { schema }
