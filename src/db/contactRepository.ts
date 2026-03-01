import { getSql } from './database';
import { Contact } from '../types';

/** Find all non-deleted contacts matching email OR phoneNumber */
export async function findContactsByEmailOrPhone(
  email: string | null | undefined,
  phoneNumber: string | null | undefined
): Promise<Contact[]> {
  const sql = getSql();
  if (!email && !phoneNumber) return [];

  if (email && phoneNumber) {
    return await sql<Contact[]>`
      SELECT * FROM Contact
      WHERE "deletedAt" IS NULL
        AND (email = ${email} OR "phoneNumber" = ${phoneNumber})
      ORDER BY "createdAt" ASC
    `;
  }

  if (email) {
    return await sql<Contact[]>`
      SELECT * FROM Contact
      WHERE "deletedAt" IS NULL AND email = ${email}
      ORDER BY "createdAt" ASC
    `;
  }

  return await sql<Contact[]>`
    SELECT * FROM Contact
    WHERE "deletedAt" IS NULL AND "phoneNumber" = ${phoneNumber!}
    ORDER BY "createdAt" ASC
  `;
}

/** Get all contacts belonging to a primary (the primary + all its secondaries) */
export async function getContactFamily(primaryId: number): Promise<Contact[]> {
  const sql = getSql();
  return await sql<Contact[]>`
    SELECT * FROM Contact
    WHERE "deletedAt" IS NULL
      AND (id = ${primaryId} OR "linkedId" = ${primaryId})
    ORDER BY "createdAt" ASC
  `;
}

/** Get a single contact by ID */
export async function getContactById(id: number): Promise<Contact | null> {
  const sql = getSql();
  const rows = await sql<Contact[]>`
    SELECT * FROM Contact WHERE id = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Create a new contact row and return the inserted record */
export async function createContact(data: {
  email: string | null;
  phoneNumber: string | null;
  linkedId: number | null;
  linkPrecedence: 'primary' | 'secondary';
}): Promise<Contact> {
  const sql = getSql();
  const rows = await sql<Contact[]>`
    INSERT INTO Contact (email, "phoneNumber", "linkedId", "linkPrecedence", "createdAt", "updatedAt")
    VALUES (${data.email}, ${data.phoneNumber}, ${data.linkedId}, ${data.linkPrecedence}, NOW(), NOW())
    RETURNING *
  `;
  return rows[0];
}

/** Demote a primary contact to secondary, pointing it at a new primary */
export async function demoteToSecondary(contactId: number, newPrimaryId: number): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE Contact
    SET "linkedId" = ${newPrimaryId},
        "linkPrecedence" = 'secondary',
        "updatedAt" = NOW()
    WHERE id = ${contactId} AND "deletedAt" IS NULL
  `;
}

/** Re-link all secondaries of oldPrimaryId to newPrimaryId */
export async function relinkSecondaries(oldPrimaryId: number, newPrimaryId: number): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE Contact
    SET "linkedId" = ${newPrimaryId},
        "updatedAt" = NOW()
    WHERE "linkedId" = ${oldPrimaryId} AND "deletedAt" IS NULL
  `;
}
