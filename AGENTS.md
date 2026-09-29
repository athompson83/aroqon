# Aroqon HQ

This repository holds Aroqon HQ, the dashboard for the Co-Founder agent, and
the agent's definition (`.claude/agents/co-founder.md`). Read
`docs/COFOUNDER.md` before you change anything. It covers the data contract,
the security model and the metric names.

## Commands

```bash
npm run dev      # next dev
npm run verify   # prettier check → typecheck → lint → vitest → next build. Run before every commit.
```

## Rules

- **A `"use server"` file may export only async functions.** Server actions
  live in `src/lib/actions.ts`. They return `{ ok: true, data }` or
  `{ ok: false, error }` and never throw across the boundary. Each one checks
  `isOwner()` first.
- **Modules that hold secrets import `server-only`**: `env.ts`, `hq.ts`,
  `resend.ts` and `auth.ts`.
- **Validate at every boundary.** Use Zod on action input and on everything
  the database returns (`src/lib/hq-types.ts`). The agent writes rows with
  raw SQL, so a malformed row is dropped, and the page still renders.
- **The `hq` schema changes only through a new migration** in
  `supabase/migrations/`. Each client-facing function checks the gateway key
  first.
- **No control that looks functional but isn't.** The mail view comes from
  shadcn/ui's MIT-licensed Mail example (see
  `src/components/mail/NOTICE.md`). Its buttons that had no backend were
  removed, not left as decoration.
- Never commit `.env*`, keys or tokens.
