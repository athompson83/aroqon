# Sending data to Aroqon HQ

Codex, the database monitor, the GitHub Actions monitor, the Vercel monitor
and the Co-Founder all report into HQ. HQ offers two ways in, and both write
the same records.

| Path                                                           | Use it when                                                                                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **SQL** with `hq.report`, `hq.signal` and `hq.resolve_missing` | The writer already has Supabase access (the Co-Founder, or Codex through the Supabase MCP) on project `fgxinxaqkwoqyywdgobs` |
| **HTTP** `POST https://hq.aroqon.com/api/ingest`               | The writer is a script or a GitHub Actions job. It needs the `HQ_INGEST_TOKEN` bearer token.                                 |

## What to send

- **Source.** A short lowercase slug naming who is reporting. The dashboard
  knows these: `cofounder`, `codex`, `db-monitor`, `actions-monitor` and
  `vercel-monitor`. Any other slug still works and gets a generated label.
  Always use the same slug for the same reporter: the slug groups reports,
  signals and freshness.
- **Report.** The Markdown write-up of one run. GitHub-flavoured Markdown
  renders with headings, tables, lists and links; raw HTML is not rendered.
  Overview shows the newest report from each source in its own tab. A source
  whose last report is more than 30 hours old is marked overdue (48 hours
  for an unknown source). Reports older than 14 days are archived, except
  each source's newest.
- **Signal.** One open issue, identified by a stable `fingerprint` such as
  `kynomy/prod-build-failing` or `proficiencyai/postgrest-timeouts`. Send
  the same fingerprint every run while the problem lasts: HQ updates the
  existing issue instead of adding a new one. Severity is `critical`,
  `warning` or `info`. A `critical` or `warning` signal colours its
  project's health on the dashboard.
- **Complete run.** Set `complete: true` (over HTTP) or call
  `hq.resolve_missing(source, fingerprints)` (over SQL). HQ then resolves
  every open signal from that source that this run did not include.
- **Metrics.** Numeric snapshots. Use a stable, dotted, lowercase name. The
  portfolio table reads `prod_deploy_ok` (1 or 0),
  `vercel.consecutive_production_errors`,
  `vercel.production_commit_drift_behind`, `open_prs`, `stale_prs` and
  `merged_prs_7d`. Anything else appears under Business. Unit is `usd`,
  `pct` (0–1), `count` or omitted.
- **Tasks.** Work for the owner or an agent. A task with `signal_fingerprint`
  is linked to that signal and closes itself when the signal resolves. A
  task whose `source_url` matches an open task updates that task instead of
  duplicating it.

## Clean-up that happens on its own

This runs every 10 minutes while the dashboard is open, and after every
ingest:

| Rule                                      | Effect                                                    |
| ----------------------------------------- | --------------------------------------------------------- |
| Signal not reported for 48 hours          | Resolved                                                  |
| Signal resolved                           | Its linked tasks are marked done, with a note             |
| Co-Founder or agent task idle for 21 days | Dropped, with a note                                      |
| Owner task idle for 14 days               | Moved to the **Stale** column; never closed automatically |
| Agent with no activity for 72 hours       | Status set to `idle`                                      |
| Report older than 14 days                 | Archived, except the source's newest                      |
| Metric older than 180 days                | Deleted                                                   |

## SQL examples

```sql
select hq.report('codex', 'daily', 'Four-App Readiness | 2026-09-30', $md$
# Four-App Executive Readiness
| App | Readiness |
|---|---|
| CATengine | … |
$md$);

select hq.signal('vercel-monitor', 'kynomy/prod-build-failing', 'critical',
  'Kynomy: 15 consecutive production builds failing',
  'Missing public-site contract groups.', 'kynomy',
  'https://vercel.com/paramedicine101-9167s-projects/kynomy');

-- End of a full run: resolve everything this run no longer saw.
select hq.resolve_missing('vercel-monitor', array['kynomy/prod-build-failing']);

insert into hq.metrics (metric, project_slug, value, unit, source)
values ('vercel.consecutive_production_errors', 'kynomy', 15, 'count', 'vercel-monitor');
```

## HTTP example (GitHub Actions)

```yaml
- name: Report to Aroqon HQ
  env:
    HQ_INGEST_TOKEN: ${{ secrets.HQ_INGEST_TOKEN }}
  run: |
    curl -fsS https://hq.aroqon.com/api/ingest \
      -H "Authorization: Bearer $HQ_INGEST_TOKEN" \
      -H "Content-Type: application/json" \
      -d @- <<'JSON'
    {
      "source": "actions-monitor",
      "complete": true,
      "reports": [{ "headline": "2 workflows failing on main", "body_md": "## Failing\n- …" }],
      "signals": [{
        "fingerprint": "certivo/verify-failing-main",
        "severity": "critical",
        "title": "Certivo: Verify failing on main",
        "project_slug": "certivo",
        "url": "https://github.com/athompson83/Certivo/actions"
      }],
      "metrics": [{ "metric": "actions.failing_workflows", "value": 2, "unit": "count" }]
    }
    JSON
```

| Response                          | Meaning                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| `200 {"ok": true, "result": {…}}` | Accepted. `result` has the counts and the housekeeping summary. |
| `401`                             | Wrong or missing token                                          |
| `413`                             | Body larger than 1 MB                                           |
| `422`                             | The payload failed validation; `issues` names the fields        |
| `503`                             | `HQ_INGEST_TOKEN` is not set on the Vercel project              |

Payload limits: 10 reports, 500 signals, 500 metrics and 100 tasks per call.
Report bodies can be up to 100,000 characters. URLs must be `https`. The
schema is in `src/lib/ingest-schema.ts`.
