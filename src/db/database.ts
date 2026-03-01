import postgres from "postgres";

let _sql: postgres.Sql | null = null;

/**
 * Returns a singleton postgres.js client.
 * Reads DATABASE_URL from the environment (set in Vercel dashboard or .env.local).
 *
 * max: 1 is intentional for serverless — each function instance gets one
 * connection and Neon's connection pooler handles the rest.
 */
export function getSql(): postgres.Sql {
  if (!_sql) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    _sql = postgres(databaseUrl, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return _sql;
}

/**
 * Run once at cold-start to ensure the Contact table and indexes exist.
 * Safe to call multiple times — uses CREATE IF NOT EXISTS.
 */
export async function initDb(): Promise<void> {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS Contact (
      id              SERIAL PRIMARY KEY,
      "phoneNumber"   TEXT,
      email           TEXT,
      "linkedId"      INTEGER REFERENCES Contact(id),
      "linkPrecedence" TEXT NOT NULL CHECK("linkPrecedence" IN ('primary', 'secondary')),
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt"     TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_contact_email
      ON Contact(email) WHERE "deletedAt" IS NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_contact_phone
      ON Contact("phoneNumber") WHERE "deletedAt" IS NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_contact_linkedId
      ON Contact("linkedId") WHERE "deletedAt" IS NULL
  `;

  console.log("Database initialised successfully");
}
