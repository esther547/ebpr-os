# EBPR OS — Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL database (local or hosted, e.g. Supabase, Neon, Railway)
- Clerk account (clerk.com)
- Supabase account (for file storage)

## Quick Start

### 1. Install dependencies
```bash
cd ebpr-os
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
```
Fill in all values in `.env.local`.

### 3. Set up Clerk
1. Create a Clerk application at clerk.com
2. Add your publishable + secret keys to `.env.local`
3. In Clerk dashboard → Configure → Sessions → add `metadata.role` to session token
4. In Clerk dashboard → Users — set `publicMetadata: { role: "SUPER_ADMIN" }` for Esther's account

### 4. Set up database
```bash
npm run db:generate    # generate Prisma client
npm run db:push        # push schema to database
npm run db:seed        # seed team members + sample client
```

### 5. Set up Supabase Storage
1. Create a bucket named `ebpr-files`
2. Set bucket policy to allow service role uploads
3. Add your Supabase keys to `.env.local`

### 6. Run development server
```bash
npm run dev
```
Open http://localhost:3000

---

## Access model (who can sign in)

Access is by invitation. Esther adds each person's **email + role** under **Settings → Team**.
On that person's first sign-in (Google or email), the Clerk account is linked to the record by email
(case-insensitive). Anyone who signs in with an email that has not been added sees an
"access pending" screen and gets nothing else. The very first user of an empty database becomes SUPER_ADMIN.

Roles are enforced from the database in each route-group layout (`lib/auth.ts` → `canAccessPath`).
Clerk `publicMetadata.role` is optional and only acts as an early redirect in middleware.

| Role | Lands on | Can open |
|------|----------|----------|
| SUPER_ADMIN (Esther) | /dashboard | everything |
| STRATEGIST | /dashboard | dashboard, clients, runners, press releases, journalists, reports |
| LEGAL (Jessica) | /legal | legal, finance, follow-up |
| FINANCE (Laurie) | /finance | finance, follow-up |
| ASSISTANT (Carolina) | /follow-up | follow-up (client names only, never amounts) |
| RUNNER (external) | /runner-portal | runner portal only |
| CLIENT_ADMIN / CLIENT_VIEWER | /portal | client portal only |

## Cron protection

`/api/cron` (daily 08:00) and `/api/digest` are public routes so Vercel can call them.
Set `CRON_SECRET` in Vercel (Settings → Environment Variables); Vercel sends it as
`Authorization: Bearer <CRON_SECRET>` automatically. A signed-in SUPER_ADMIN can also open
them in the browser. Without the secret, only a SUPER_ADMIN can trigger them.

## Local testing as any role (never in production)

Add `DEV_AUTH_BYPASS=1` to your local `.env`, run `npm run dev`, then open
`http://localhost:3000/api/dev/switch-user?email=<seeded email>` to act as that user
(`?clear=1` to stop). This only works when `NODE_ENV=development`; Vercel builds ignore it.

## Legacy: Clerk metadata roles (optional)

Set `publicMetadata` on a Clerk user for an early middleware redirect:

| Person  | Role          |
|---------|---------------|
| Esther  | SUPER_ADMIN   |
| Anna    | STRATEGIST    |
| Juanita | STRATEGIST    |
| Tomas   | STRATEGIST    |
| Vero    | STRATEGIST    |
| Paola   | STRATEGIST    |
| Jessica | LEGAL         |
| Lori    | FINANCE       |
| Runners | RUNNER        |
| Clients | CLIENT_ADMIN or CLIENT_VIEWER |

In Clerk dashboard → Users → Select user → Metadata:
```json
{ "role": "STRATEGIST" }
```

Client portal users get `CLIENT_ADMIN` or `CLIENT_VIEWER`.

---

## Key URLs

| Route | Who sees it |
|-------|------------|
| `/clients` | Esther, Strategists |
| `/legal` | Jessica, Esther |
| `/runners/schedule` | All runners + strategists |
| `/reports` | Esther, strategists, Lori |
| `/settings` | Esther only |
| `/portal` | Client portal users only |

---

## Deployment (Vercel)

```bash
vercel
```
Add all env vars in Vercel dashboard → Settings → Environment Variables.
