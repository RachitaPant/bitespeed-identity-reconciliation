# Bitespeed Identity Reconciliation Service

A web service that identifies and reconciles customer identities across multiple purchases using shared contact information (email / phone number).

## Live Endpoint

> After deploying, update this URL:
> `https://your-app.vercel.app/identify`

---

## Tech Stack

| Layer     | Technology                      |
| --------- | ------------------------------- |
| Runtime   | Node.js (v18+)                  |
| Language  | TypeScript                      |
| Framework | Express.js                      |
| Database  | Neon Postgres (via postgres.js) |
| Hosting   | Vercel                          |

---

## Project Structure

```
bitespeed-identity-reconciliation/
├── src/
│   ├── index.ts                  # App entry point
│   ├── types/
│   │   └── index.ts              # Shared TypeScript interfaces
│   ├── db/
│   │   ├── database.ts           # Neon connection + schema init
│   │   └── contactRepository.ts  # All DB queries (async)
│   ├── services/
│   │   └── identityService.ts    # Core reconciliation logic
│   └── routes/
│       └── identify.ts           # POST /identify route handler
├── vercel.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## API

### `POST /identify`

**Request Body (JSON):**

```json
{
  "email": "user@example.com",
  "phoneNumber": "1234567890"
}
```

At least one of `email` or `phoneNumber` must be provided.

**Response (200 OK):**

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["primary@example.com", "secondary@example.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": [2, 3]
  }
}
```

### `GET /health`

Returns `{ "status": "ok" }`.

---

## Reconciliation Logic

1. **No match** → Create a new `primary` contact.
2. **Match, no new info** → Return the consolidated contact family.
3. **Match, new info** → Create a `secondary` linked to the oldest primary.
4. **Two separate primaries linked by request** → Merge: older primary wins, newer is demoted to `secondary`.

---

## Deploying to Vercel + Neon

### 1. Set up Neon Postgres (free)

1. Go to [neon.tech](https://neon.tech) → create a free project.
2. Copy the **Connection String** (looks like `postgres://user:pass@host/dbname?sslmode=require`).

### 2. Deploy to Vercel

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# From project root
vercel

# Follow the prompts, then add the env var:
vercel env add DATABASE_URL
# Paste your Neon connection string when prompted
```

Or via the Vercel dashboard:

1. Import your GitHub repo at [vercel.com/new](https://vercel.com/new).
2. Under **Environment Variables**, add `DATABASE_URL` = your Neon connection string.
3. Deploy.

The table and indexes are created automatically on first request — no manual migration needed.

### 3. Test it

```bash
curl -X POST https://your-app.vercel.app/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "lorraine@hillvalley.edu", "phoneNumber": "123456"}'
```

---

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local with your Neon connection string
echo "DATABASE_URL=postgres://..." > .env.local

# 3. Run dev server
npm run dev
```

---
