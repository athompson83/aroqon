# Co-Founder operating manual

The Co-Founder agent (`.claude/agents/co-founder.md`) runs the business side of
the portfolio. Its state lives in Postgres and is shown at **Aroqon HQ**, the
Next.js app in this repository.

## Where things are

| Thing            | Where                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Agent definition | `.claude/agents/co-founder.md`                                                                 |
| State            | `hq` schema in the Supabase project `fgxinxaqkwoqyywdgobs` (the Aroqon / Data Foundry project) |
| Schema source    | `supabase/migrations/20260927160000_hq_cofounder.sql`                                          |
| Dashboard        | this repo, Vercel project `aroqon`, `https://hq.aroqon.com`                                    |
| Mail             | Resend: received and sent mail, read live by the dashboard                                     |

## Security model

- `hq` is not exposed through the Supabase REST API. Its tables have RLS
  on, and every client privilege is revoked.
- The dashboard reaches it only through four `SECURITY DEFINER` functions
  (`public.hq_dashboard`, `hq_task_save`, `hq_triage_save`,
  `hq_consume_nonce`). Each one first checks a 256-bit gateway key against
  a bcrypt hash in `hq.gateway_keys`. The key exists only in the Vercel
  environment (`HQ_DB_KEY`). To rotate it, insert a new hash, deploy the new
  key, then set `revoked_at` on the old row.
- The owner signs in with a one-time emailed link. It is HMAC-signed, expires
  after 15 minutes, and cannot be used twice because its nonce is consumed in
  `hq.login_nonces`. It sets a 30-day httpOnly session cookie. Only
  `HQ_OWNER_EMAIL` can sign in. The form gives the same answer for every
  address, so it does not reveal whose HQ it is.
- Email HTML is rendered in an iframe with an empty `sandbox`: no scripts,
  and no access to HQ's origin.
- The Co-Founder writes with the Supabase `execute_sql` tool, which
  connects as the database owner. That path needs no gateway key.

## Tables

| Table             | Key                    | Notes                                                                                                                                        |
| ----------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `hq.projects`     | `slug`                 | `stage` idea/build/beta/live/paused/retired · `health` green/yellow/red/unknown · `focus`, `next_milestone`                                  |
| `hq.tasks`        | `id`                   | `owner` owner/cofounder/agent · `priority` p0–p3 · `status` open/doing/blocked/done/dropped · `due_on`, `source`, `source_url`, `created_by` |
| `hq.agents`       | `id`                   | `status` on_track/drifting/blocked/idle/unknown · `mission`, `last_activity`, `last_activity_at`, `evidence_url`                             |
| `hq.metrics`      | append-only            | `metric`, `project_slug` (null = portfolio), `value`, `unit` usd/pct/null, `source`, `as_of`                                                 |
| `hq.briefs`       | `id`                   | `kind` daily/weekly/adhoc · `headline` · `body_md`                                                                                           |
| `hq.email_triage` | `email_id` (Resend id) | `direction`, `category`, `priority` urgent/normal/low, `summary`, `action`, `task_id`, `handled`                                             |

Project slugs: `data-foundry`, `captivate`, `certivo`, `proficiencyai`,
`itemgen`, `catengine`, `mastery-mindset`, `kynomy`, `rise`.

## Standard metric names

Use these names so that each series lines up over time. Add new names here
before you use them.

| Metric                 | Unit  | Source                                                                  |
| ---------------------- | ----- | ----------------------------------------------------------------------- |
| `open_prs`             | count | GitHub, per project                                                     |
| `failing_prs`          | count | GitHub: open PRs whose latest checks are red                            |
| `stale_prs`            | count | GitHub: open more than 2 days with no activity                          |
| `merged_prs_7d`        | count | GitHub                                                                  |
| `open_issues`          | count | GitHub                                                                  |
| `prod_deploy_ok`       | 1/0   | Vercel: the latest production deployment is READY                       |
| `mrr`                  | usd   | Stripe, per product where it can be attributed, otherwise the portfolio |
| `revenue_30d`          | usd   | Stripe                                                                  |
| `active_subscriptions` | count | Stripe                                                                  |
| `emails_sent_7d`       | count | Resend                                                                  |
| `email_bounces_7d`     | count | Resend                                                                  |
| `alerts_7d`            | count | Resend (received mail in the Alerts category)                           |
| `leads_7d`             | count | Supabase (e.g. `rise_leads`)                                            |

## Email organisation

Mail is filed by `src/lib/mail-organize.ts`, and a triage row always
overrides it. The Co-Founder writes triage rows. The owner writes them too,
from the Mail view, by re-filing a message or marking it handled.

| Category  | Rule                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Alerts    | Subject names a failure, error, backup or outage, or the mail was sent to an `alerts@` address. Urgent when something failed. |
| Auth      | Password resets, verification codes and sign-in links. Low priority.                                                          |
| Billing   | Invoices, receipts, payments and subscriptions.                                                                               |
| Customers | A person on an outside domain writing to one of ours. Urgent until handled.                                                   |
| Product   | Automated mail from our own domains.                                                                                          |
| Other     | Everything else.                                                                                                              |

Our domains map to projects in `PROJECT_DOMAINS`.

## Dashboard environment (Vercel project `aroqon`)

`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `HQ_DB_KEY`, `HQ_SESSION_SECRET`,
`HQ_OWNER_EMAIL`, `HQ_SIGNIN_FROM`, `HQ_BASE_URL`, `RESEND_API_KEY`.
`src/lib/env.ts` validates them the first time the app needs them.
