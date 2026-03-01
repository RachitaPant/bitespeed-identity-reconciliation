import { neon } from "@neondatabase/serverless";

// neon() returns a tagged-template SQL function that sends queries over HTTP.
// This is required on Vercel — raw TCP port 5432 is blocked in serverless.
// We create it once per cold start (singleton pattern).
let _sql: ReturnType<typeof neon> | null = null;

export function getSql(): ReturnType<typeof neon> {
  if (!_sql) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    _sql = neon(databaseUrl);
  }
  return _sql;
}

/**
 * Creates the Contact table and indexes if they don't exist.
 * Called lazily on the first request (see routes/identify.ts).
 */
export async function initDb(): Promise<void> {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS Contact (
      id               SERIAL PRIMARY KEY,
      "phoneNumber"    TEXT,
      email            TEXT,
      "linkedId"       INTEGER REFERENCES Contact(id),
      "linkPrecedence" TEXT NOT NULL CHECK("linkPrecedence" IN ('primary', 'secondary')),
      "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt"      TIMESTAMPTZ
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_contact_email
    ON Contact(email) WHERE "deletedAt" IS NULL`;

  await sql`CREATE INDEX IF NOT EXISTS idx_contact_phone
    ON Contact("phoneNumber") WHERE "deletedAt" IS NULL`;

  await sql`CREATE INDEX IF NOT EXISTS idx_contact_linkedId
    ON Contact("linkedId") WHERE "deletedAt" IS NULL`;

  console.log("Database initialised successfully");
}
