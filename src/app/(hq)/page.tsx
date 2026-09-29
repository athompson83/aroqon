import Link from "next/link";

import { Attention } from "@/components/hq/attention";
import { Markdown } from "@/components/hq/markdown";
import { ReportsPanel } from "@/components/hq/reports-panel";
import { Dot, Panel, Sparkline, Stat } from "@/components/hq/ui";
import {
  agentStats,
  formatValue,
  projectProgress,
  seriesFrom,
  taskStats,
  type Series,
} from "@/lib/analytics";
import { loadDashboard } from "@/lib/hq";
import { mailStats, organize } from "@/lib/mail-organize";
import { fetchMail } from "@/lib/resend";
import {
  ageLabel,
  isStaleTask,
  latestBySource,
  openSignals,
  projectStatus,
  sourceLabel,
} from "@/lib/status";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Per-project columns of the portfolio table: the numbers the monitors keep
// fresh, in the order you would triage them.
const MATRIX: {
  metric: string;
  label: string;
  bad: (v: number) => boolean;
  format?: (v: number) => string;
}[] = [
  { metric: "prod_deploy_ok", label: "Prod", bad: (v) => v === 0, format: (v) => (v ? "✓" : "✗") },
  { metric: "vercel.consecutive_production_errors", label: "Failing builds", bad: (v) => v > 0 },
  { metric: "vercel.production_commit_drift_behind", label: "Behind main", bad: (v) => v > 0 },
  { metric: "open_prs", label: "Open PRs", bad: () => false },
  { metric: "stale_prs", label: "Stale PRs", bad: (v) => v > 10 },
  { metric: "merged_prs_7d", label: "Merged 7d", bad: () => false },
];
const MATRIX_METRICS = new Set(MATRIX.map((m) => m.metric));

export default async function Overview() {
  const [data, mail] = await Promise.all([
    loadDashboard(),
    fetchMail().catch((e: Error) => ({ mails: [], error: e.message })),
  ]);
  const nowMs = Date.now();
  const today = new Date(nowMs).toISOString().slice(0, 10);

  const tasks = taskStats(data.tasks, today);
  const staleCount = data.tasks.filter((t) => t.owner === "owner" && isStaleTask(t, nowMs)).length;
  const agents = agentStats(data.agents);
  const m = mailStats(organize(mail.mails, data.triage));
  const series = seriesFrom(data.metrics);
  const open = openSignals(data.signals);
  const critical = open.filter((s) => s.severity === "critical").length;
  const resolvedThisWeek = data.signals.filter((s) => s.status === "resolved").length;
  const projectName = Object.fromEntries(data.projects.map((p) => [p.slug, p.name]));

  const sources = latestBySource(data.briefs, nowMs);
  const sourceLabels = Object.fromEntries(
    [...new Set([...data.signals.map((s) => s.source), ...sources.map((s) => s.source)])].map(
      (s) => [s, sourceLabel(s)],
    ),
  );

  const statuses = data.projects
    .map((p) => ({ project: p, status: projectStatus(p, data.signals, series, nowMs) }))
    .sort(
      (a, b) =>
        rank(a.status.health) - rank(b.status.health) ||
        a.project.name.localeCompare(b.project.name),
    );
  const cell = (slug: string, metric: string) =>
    series.find((s) => s.project === slug && s.metric === metric);
  const portfolioSeries = series.filter((s) => !s.project || !MATRIX_METRICS.has(s.metric));

  const progress = projectProgress(data.tasks);
  const nextUp = data.tasks.filter((t) => t.status !== "done" && t.status !== "dropped");
  const hk = data.housekeeping;

  return (
    <div className="mx-auto w-full max-w-[2400px] space-y-6 p-4 sm:p-6 2xl:px-10">
      <Panel
        title={open.length ? `Attention · ${open.length} open` : "Attention"}
        action={
          <>
            {resolvedThisWeek} resolved this week
            {hk && ` · auto-cleaned ${ageLabel(hk.ran_at, nowMs)} ago`}
          </>
        }
      >
        <Attention
          signals={open}
          projectNames={projectName}
          sourceLabels={sourceLabels}
          ages={Object.fromEntries(open.map((s) => [s.id, ageLabel(s.last_seen, nowMs)]))}
        />
      </Panel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Open issues"
          value={String(open.length)}
          hint={critical ? `${critical} critical` : undefined}
          tone={critical ? "bad" : open.length ? "warn" : "good"}
        />
        <Stat
          label="Your open to-dos"
          value={String(tasks.mine)}
          hint={`${tasks.open} open in total`}
        />
        <Stat label="P0" value={String(tasks.p0)} tone={tasks.p0 ? "bad" : "good"} />
        <Stat
          label="Overdue · stale"
          value={`${tasks.overdue} · ${staleCount}`}
          hint="stale = untouched 14 days"
          tone={tasks.overdue || staleCount ? "warn" : "good"}
        />
        <Stat
          label="Agents on track"
          value={`${agents.on_track}/${data.agents.length}`}
          hint={
            agents.drifting + agents.blocked + agents.idle
              ? `${agents.drifting} drifting · ${agents.blocked} blocked · ${agents.idle} idle`
              : undefined
          }
          tone={agents.drifting + agents.blocked ? "warn" : "good"}
        />
        <Stat
          label="Mail needing you"
          value={String(m.needsAttention)}
          hint={m.urgent ? `${m.urgent} urgent` : undefined}
          tone={m.urgent ? "bad" : undefined}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <Panel
          title="Reports"
          action={
            <Link href="/reports" className="hover:text-foreground">
              All reports →
            </Link>
          }
          className="xl:col-span-7"
        >
          <ReportsPanel
            tabs={sources.map((s) => ({
              source: s.source,
              label: s.label,
              headline: s.latest.headline,
              age: ageLabel(s.latest.created_at, nowMs),
              stale: s.stale,
              id: s.latest.id,
              body: <Markdown source={s.latest.body_md} />,
            }))}
          />
        </Panel>

        <Panel
          title="Portfolio"
          action="Health follows open issues and monitor metrics"
          className="xl:col-span-5"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-normal">Project</th>
                  {MATRIX.map((c) => (
                    <th key={c.metric} className="px-2 py-2 text-right font-normal">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {statuses.map(({ project: p, status }) => (
                  <tr key={p.slug} className="align-top">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <Dot status={status.health} />
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{p.stage}</span>
                      </div>
                      {status.reasons.length > 0 && (
                        <div className="mt-0.5 pl-[18px] text-xs text-muted-foreground">
                          {status.reasons.join(" · ")}
                        </div>
                      )}
                      {p.focus && <div className="mt-0.5 pl-[18px] text-xs">{p.focus}</div>}
                      {progress.get(p.slug) && (
                        <div className="mt-0.5 pl-[18px] text-xs text-muted-foreground">
                          To-dos: {progress.get(p.slug)!.done}/{progress.get(p.slug)!.total} done
                          {progress.get(p.slug)!.doing > 0 &&
                            ` · ${progress.get(p.slug)!.doing} doing`}
                          {progress.get(p.slug)!.blocked > 0 &&
                            ` · ${progress.get(p.slug)!.blocked} blocked`}
                        </div>
                      )}
                    </td>
                    {MATRIX.map((c) => {
                      const s = cell(p.slug, c.metric);
                      return (
                        <td
                          key={c.metric}
                          className={cn(
                            "px-2 py-2 text-right tabular-nums",
                            s && c.bad(s.latest) ? "font-medium text-bad" : "text-muted-foreground",
                          )}
                          title={
                            s ? `${s.source} · ${ageLabel(s.asOf, nowMs)} ago` : "Not reported"
                          }
                        >
                          {s
                            ? c.format
                              ? c.format(s.latest)
                              : s.latest.toLocaleString("en-US")
                            : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <Panel
          title="Next up"
          action={
            <Link href="/todo" className="hover:text-foreground">
              All to-dos →
            </Link>
          }
          className="xl:col-span-5"
        >
          {nextUp.length ? (
            <ul className="max-h-[60vh] divide-y overflow-y-auto pr-1">
              {nextUp.map((t) => (
                <li key={t.id} className="flex items-baseline gap-3 py-2 text-sm">
                  <span className="w-7 shrink-0 font-mono text-xs uppercase text-muted-foreground">
                    {t.priority}
                  </span>
                  <span className="min-w-0 flex-1">
                    {t.source_url && /^https:\/\//.test(t.source_url) ? (
                      <a
                        href={t.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {t.title}
                      </a>
                    ) : (
                      t.title
                    )}
                    {t.project_slug && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {projectName[t.project_slug] ?? t.project_slug}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <StatusChip status={t.status} />
                    {t.owner === "owner" && isStaleTask(t, nowMs) && (
                      <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[11px] text-warn">
                        stale
                      </span>
                    )}
                    {t.owner !== "owner" && <span>{t.owner}</span>}
                    {t.due_on && <span>due {t.due_on}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing open.</p>
          )}
        </Panel>

        <Panel title="Agents" action="Idle after 72h quiet" className="xl:col-span-3">
          <ul className="divide-y">
            {data.agents.map((a) => (
              <li key={a.id} className="flex gap-3 py-2.5 text-sm">
                <Dot status={a.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.status.replace("_", " ")}
                    </span>
                    {a.last_activity_at && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {ageLabel(a.last_activity_at, nowMs)}
                      </span>
                    )}
                  </div>
                  {a.last_activity && (
                    <div className="text-xs text-muted-foreground">
                      {a.evidence_url && /^https:\/\//.test(a.evidence_url) ? (
                        <a
                          href={a.evidence_url}
                          className="underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {a.last_activity}
                        </a>
                      ) : (
                        a.last_activity
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-6 xl:col-span-4">
          <Panel title="Business">
            {portfolioSeries.length ? (
              <ul className="divide-y text-sm">
                {portfolioSeries.map((s) => (
                  <MetricRow
                    key={`${s.metric}-${s.project}`}
                    s={s}
                    projectName={projectName}
                    nowMs={nowMs}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No metrics recorded yet.</p>
            )}
          </Panel>
          <Panel
            title="Mail"
            action={
              <Link href="/mail" className="hover:text-foreground">
                Open mail →
              </Link>
            }
          >
            {mail.error && <p className="mb-2 text-xs text-bad">Resend: {mail.error}</p>}
            <ul className="space-y-2 text-sm">
              {Object.entries(m.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, n]) => (
                  <li key={cat} className="flex items-center gap-3">
                    <span className="w-24">{cat}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${(n / Math.max(1, m.received)) * 100}%` }}
                      />
                    </span>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">{n}</span>
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              {m.needsAttention} need you · {m.deliveryProblems} delivery problems in the last{" "}
              {m.sent} sent
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function rank(h: string) {
  return ({ red: 0, yellow: 1, unknown: 2, green: 3 } as Record<string, number>)[h] ?? 4;
}

function MetricRow({
  s,
  projectName,
  nowMs,
}: {
  s: Series;
  projectName: Record<string, string>;
  nowMs: number;
}) {
  const delta = s.previous === null ? null : s.latest - s.previous;
  return (
    <li
      className="flex items-center gap-3 py-2"
      title={`${s.source} · ${ageLabel(s.asOf, nowMs)} ago`}
    >
      <span className="min-w-0 flex-1">
        {s.metric.replace(/^vercel\./, "").replace(/_/g, " ")}
        <span className="ml-2 text-xs text-muted-foreground">
          {s.project ? (projectName[s.project] ?? s.project) : "Portfolio"}
        </span>
      </span>
      <Sparkline points={s.points} />
      <span className="w-20 text-right tabular-nums">{formatValue(s.latest, s.unit)}</span>
      <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
        {delta ? `${delta > 0 ? "+" : ""}${formatValue(delta, s.unit)}` : ""}
      </span>
    </li>
  );
}

const CHIP = {
  open: "bg-muted text-muted-foreground",
  doing: "bg-primary/15 text-primary",
  blocked: "bg-bad/15 text-bad",
  done: "bg-good/15 text-good",
  dropped: "bg-muted text-muted-foreground line-through",
} as const;

function StatusChip({ status }: { status: keyof typeof CHIP }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${CHIP[status]}`}>
      {status}
    </span>
  );
}
