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

## User Role Setup (Clerk)

Set `publicMetadata` on each Clerk user to assign roles:

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
