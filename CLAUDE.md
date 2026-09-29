# CLAUDE.md — SPAZEHAUS App

Internal management app for **SPAZEHAUS** (Johor Bahru interior design firm).
Auth-gated staff tool + read-only client portals. Fully database-backed.

- **Repo:** `Say-Sheji-Group-Sdn-Bhd/spazehaus` · **Live:** https://spazehaus.vercel.app · **Deploy:** Vercel (auto-deploys `main`)
- **Database:** Supabase project `exajkbvaqjqdedqavbvs` (Singapore, free tier)
- **Stack:** Vite 7 · React 19 · wouter (routing) · Supabase · Tailwind v4 · TypeScript · **bun**

## Read these first (source of truth)
- `ONBOARDING.md` — dev + operator guide, env setup, GitHub/Supabase access
- `progress.md` — running log of what's built and what's next
- `supabase/README.md` — DB / migrations notes

## Commands
```bash
bun run dev          # local dev (Vite, --host)
bun run check        # tsc --noEmit (typecheck)
bun run test:unit    # vitest run
bun run build        # client + server bundle
bun run format       # prettier
bun run gen:types    # regenerate database.types.ts (needs $SUPABASE_PROJECT_REF)
```

## Conventions
- **Auth:** staff sign in via Supabase magic link; clients use public `/portal/:token`.
- **Data:** every page reads real Postgres through Supabase — no mock data.
- **DB changes:** add a migration under `supabase/migrations/`, then `gen:types` to refresh types.
- **RLS matters:** respect row-level security; mirror policy logic in client guards (see `queries.ts`).
- Relationship to `code-sayprojects`: this app is a feature-behind sibling of the Say Projects app (same stack).
- **Commits:** small, feature-bundled, short imperative subject (≤10 words).
