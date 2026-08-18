# Quorum Nexus

Credit card points and loyalty program optimizer.

Next.js 14 (App Router) + Supabase Postgres backend + Gmail OAuth for
inbox-based points balance detection.

## How it works

- Users connect Gmail (`/api/auth/gmail`) via OAuth (read-only scope).
- `/api/email/parse` scans recent inbox mail (and PDF statement
  attachments) with a regex-based parser (`lib/parser.ts`) to detect
  loyalty program balances, earn/redeem/expiry events, and linked credit
  cards.
- `/email-settings` shows connection status, lets you trigger a manual
  sync, and doubles as an evidence/debug view of every parsed email.
- `/dashboard`, `/cards`, `/redeem`, `/wishlist`, `/routes` read/write
  Supabase directly from the browser (anon key, scoped to a single demo
  user).

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=
```

## Notes

`lib/db.ts` is a hand-rolled server-side PostgREST client (not
`supabase-js`) — `supabase-js` was found to silently return empty
results for privileged server-side reads, so this raw `fetch()` wrapper
replaces it for all API routes. Client components continue to use
`@supabase/supabase-js` via `lib/pub.ts` with the anon key.
