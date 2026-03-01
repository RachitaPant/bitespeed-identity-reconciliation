import {
  findContactsByEmailOrPhone,
  getContactFamily,
  getContactById,
  createContact,
  demoteToSecondary,
  relinkSecondaries,
} from '../db/contactRepository';
import { Contact, IdentifyRequest, IdentifyResponse } from '../types';

/**
 * Resolve the true primary ID for a contact.
 * Primary → its own id. Secondary → its linkedId (which IS the primary id).
 */
function resolvePrimaryId(contact: Contact): number {
  if (contact.linkPrecedence === 'primary') return contact.id;
  return contact.linkedId!;
}

/**
 * Given matched contacts, collect all unique primary IDs and pick the oldest
 * (earliest createdAt) as the winner. Fetches from DB when needed.
 */
async function determineWinningPrimary(matched: Contact[]): Promise<number> {
  const primaryIds = new Set<number>(matched.map(resolvePrimaryId));

  if (primaryIds.size === 1) return [...primaryIds][0];

  // Multiple primaries — pick the oldest by createdAt
  let winnerPrimaryId: number | null = null;
  let winnerCreatedAt: Date | null = null;

  for (const pid of primaryIds) {
    // Try matched set first, fall back to DB lookup
    let primary: Contact | null = matched.find((c) => c.id === pid) ?? null;
    if (!primary) primary = await getContactById(pid);

    const createdAt = primary ? new Date(primary.createdAt) : new Date();
    if (winnerCreatedAt === null || createdAt < winnerCreatedAt) {
      winnerCreatedAt = createdAt;
      winnerPrimaryId = pid;
    }
  }

  return winnerPrimaryId!;
}

/**
 * Build the final IdentifyResponse from the contact family.
 * Primary's email/phone always appear first.
 */
function buildResponse(primaryId: number, family: Contact[]): IdentifyResponse {
  const primary = family.find((c) => c.id === primaryId)!;

  const emails: string[] = [];
  const phoneNumbers: string[] = [];
  const secondaryContactIds: number[] = [];

  if (primary.email) emails.push(primary.email);
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

  for (const c of family) {
    if (c.id === primaryId) continue;
    secondaryContactIds.push(c.id);
    if (c.email && !emails.includes(c.email)) emails.push(c.email);
    if (c.phoneNumber && !phoneNumbers.includes(c.phoneNumber))
      phoneNumbers.push(c.phoneNumber);
  }

  return {
    contact: {
      primaryContatctId: primaryId,
      emails,
      phoneNumbers,
      secondaryContactIds,
    },
  };
}

/**
 * Core identity reconciliation logic.
 *
 * Case A: No existing contacts           → create new primary.
 * Case B: Two separate primaries matched → merge (older wins).
 * Case C: New info on existing contact   → create secondary linked to primary.
 * Case D: Exact match, no new info       → return consolidated response.
 */
export async function identify(req: IdentifyRequest): Promise<IdentifyResponse> {
  const email = req.email?.trim() || null;
  const phoneNumber = req.phoneNumber?.toString().trim() || null;

  // Step 1: Find all contacts sharing the given email OR phoneNumber
  const matched = await findContactsByEmailOrPhone(email, phoneNumber);

  // ── Case A: No existing contacts ────────────────────────────────────────
  if (matched.length === 0) {
    const newContact = await createContact({
      email,
      phoneNumber,
      linkedId: null,
      linkPrecedence: 'primary',
    });
    return buildResponse(newContact.id, [newContact]);
  }

  // Step 2: Determine the single winning primary
  const winningPrimaryId = await determineWinningPrimary(matched);
  const allPrimaryIds = new Set<number>(matched.map(resolvePrimaryId));

  // ── Case B: Multiple primaries must be merged ────────────────────────────
  if (allPrimaryIds.size > 1) {
    for (const pid of allPrimaryIds) {
      if (pid === winningPrimaryId) continue;
      await demoteToSecondary(pid, winningPrimaryId);
      await relinkSecondaries(pid, winningPrimaryId);
    }
  }

  // Step 3: Check if the request introduces new information
  const family = await getContactFamily(winningPrimaryId);
  const emailKnown   = !email       || family.some((c) => c.email       === email);
  const phoneKnown   = !phoneNumber || family.some((c) => c.phoneNumber === phoneNumber);

  // ── Case C: New information → create a secondary contact ─────────────────
  if (!emailKnown || !phoneKnown) {
    const secondary = await createContact({
      email,
      phoneNumber,
      linkedId: winningPrimaryId,
      linkPrecedence: 'secondary',
    });
    family.push(secondary);
  }

  // Step 4: Build and return the consolidated response
  return buildResponse(winningPrimaryId, family);
}
