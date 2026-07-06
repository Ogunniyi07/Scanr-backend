# Scanr Backend

A Node.js + Express + TypeScript API for the Scanr receipt/invoice scanning app,
using PostgreSQL (via Prisma) for storage and the Anthropic API for OCR extraction.

## What's built so far

- Project scaffold, TypeScript config
- Database schema (`prisma/schema.prisma`) for User, Scan, LineItem
- Auth endpoints: signup, login, forgot-password, reset-password, logout
- Protected user endpoints: `GET /user/me`, `PUT /user/profile`, `PUT /user/notifications`
- JWT-based auth middleware for protecting routes

## What's not built yet (next steps)

- `/scans` upload + Claude vision extraction
- `/scans` history listing with filters
- Scan approve/discard/edit endpoints
- Billing and export endpoints

## Prerequisites

1. **Node.js** (v18+) - you already have this if you can run the frontend.
2. **PostgreSQL** - a database server. Easiest options:
   - Install locally: https://www.postgresql.org/download/
   - Or use a free hosted one to skip local setup: https://neon.tech or https://supabase.com
     (both give you a `DATABASE_URL` connection string instantly)

## Setup steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create your `.env` file**
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and fill in:
   - `DATABASE_URL` - your Postgres connection string
   - `JWT_SECRET` - any long random string (e.g. run `openssl rand -hex 32` in your terminal)
   - `ANTHROPIC_API_KEY` - from https://console.anthropic.com (only needed once you build the scan endpoint)

3. **Create the database tables**
   ```bash
   npm run prisma:migrate
   ```
   This reads `prisma/schema.prisma` and creates the actual tables in your database.
   It'll ask you to name the migration - "init" is fine.

4. **Start the dev server**
   ```bash
   npm run dev
   ```
   You should see `Scanr backend running on http://localhost:4000`.

5. **Test it's alive**

   Visit http://localhost:4000/health in your browser - you should see `{"status":"ok"}`.

## Testing the auth flow

Once the server is running, test signup with curl (or Postman/Insomnia if you prefer a UI):

```bash
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Juls Test","email":"juls@example.com","password":"password123","agreedToTerms":true}'
```

You should get back `{ "user": {...}, "token": "..." }`. Copy that token and try:

```bash
curl http://localhost:4000/user/me \
  -H "Authorization: Bearer PASTE_TOKEN_HERE"
```

You should get your user profile back. If you get a 401, the token is missing/wrong.

## Connecting the frontend

In your Scanr frontend, wherever `login.tsx` / `signup.tsx` currently just do
`setTimeout` and local state, replace with a real fetch call, e.g.:

```ts
const res = await fetch("http://localhost:4000/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const data = await res.json();
if (res.ok) {
  localStorage.setItem("token", data.token);
  // redirect to /dashboard
} else {
  // show data.message as an error
}
```

Then for any protected request, attach the stored token:

```ts
fetch("http://localhost:4000/user/me", {
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});
```

## Viewing your database visually

```bash
npm run prisma:studio
```
Opens a browser UI where you can see/edit rows in your tables directly - handy for debugging.

## Project structure

```
src/
  index.ts              - server entry point, mounts routes
  routes/
    auth.ts              - signup, login, password reset
    user.ts               - profile, notifications (protected)
  middleware/
    requireAuth.ts        - verifies JWT on protected routes
  lib/
    prisma.ts             - shared database client
    auth.ts                - password hashing, JWT sign/verify
prisma/
  schema.prisma           - database table definitions
```
