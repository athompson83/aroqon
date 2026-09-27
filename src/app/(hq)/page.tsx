import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { Markdown } from "@/components/hq/markdown";
import { Dot, Panel, Sparkline, Stat } from "@/components/hq/ui";
import { agentStats, formatValue, seriesFrom, taskStats } from "@/lib/analytics";
import { loadDashboard } from "@/lib/hq";
import { mailStats, organize } from "@/lib/mail-organize";
import { fetchMail } from "@/lib/resend";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const [data, mail] = await Promise.all([
    loadDashboard(),
    fetchMail().catch((e: Error) => ({ mails: [], error: e.message })),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const tasks = taskStats(data.tasks, today);
  const agents = agentStats(data.agents);
  const mailItems = organize(mail.mails, data.triage);
  const m = mailStats(mailItems);
  const series = seriesFrom(data.metrics);
  const brief = data.briefs[0];
  const nextUp = data.tasks
    .filter((t) => t.status !== "done" && t.status !== "dropped")
    .slice(0, 8);
  const projectName = new Map(data.projects.map((p) => [p.slug, p.name]));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <Panel
        title={brief ? brief.headline : "No brief yet"}
        action={
          brief
            ? `${brief.kind} brief · ${formatDistanceToNow(new Date(brief.created_at), { addSuffix: true })}`
            : undefined
        }
      >
        {brief ? (
          <Markdown source={brief.body_md} />
        ) : (
          <p className="text-sm text-muted-foreground">
            The Co-Founder posts a brief here after its first scheduled run.
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Your open to-dos"
          value={String(tasks.mine)}
          hint={`${tasks.open} open in total`}
        />
        <Stat label="P0" value={String(tasks.p0)} tone={tasks.p0 ? "bad" : "good"} />
        <Stat
          label="Overdue"
          value={String(tasks.overdue)}
          tone={tasks.overdue ? "warn" : "good"}
        />
        <Stat
          label="Agents on track"
          value={`${agents.on_track}/${data.agents.length}`}
          hint={
            agents.drifting + agents.blocked
              ? `${agents.drifting} drifting · ${agents.blocked} blocked`
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
        <Stat
          label="Delivery problems"
          value={String(m.deliveryProblems)}
          hint={`of last ${m.sent} sent`}
          tone={m.deliveryProblems ? "warn" : "good"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          title="Next up"
          action={
            <Link href="/todo" className="hover:text-foreground">
              All to-dos →
            </Link>
          }
          className="lg:col-span-3"
        >
          {nextUp.length ? (
            <ul className="divide-y">
              {nextUp.map((t) => (
                <li key={t.id} className="flex items-baseline gap-3 py-2 text-sm">
                  <span className="w-7 shrink-0 font-mono text-xs uppercase text-muted-foreground">
                    {t.priority}
                  </span>
                  <span className="flex-1">
                    {t.title}
                    {t.project_slug && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {projectName.get(t.project_slug) ?? t.project_slug}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.status === "open" ? t.owner : t.status}
                    {t.due_on && ` · due ${t.due_on}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing open.</p>
          )}
        </Panel>

        <Panel
          title="Mail by category"
          action={
            <Link href="/mail" className="hover:text-foreground">
              Open mail →
            </Link>
          }
          className="lg:col-span-2"
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
            Last {m.received} received and {m.sent} sent through Resend.
          </p>
        </Panel>
      </div>

      <Panel
        title="Analytics"
        action={series.length ? "Recorded by the Co-Founder from each source" : undefined}
      >
        {series.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-normal">Metric</th>
                  <th className="py-2 pr-4 font-normal">Project</th>
                  <th className="py-2 pr-4 text-right font-normal">Latest</th>
                  <th className="py-2 pr-4 text-right font-normal">Change</th>
                  <th className="py-2 pr-4 font-normal">Trend</th>
                  <th className="py-2 font-normal">Source · as of</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {series.map((s) => {
                  const delta = s.previous === null ? null : s.latest - s.previous;
                  return (
                    <tr key={`${s.metric}-${s.project}`}>
                      <td className="py-2 pr-4">{s.metric.replace(/_/g, " ")}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {s.project ? (projectName.get(s.project) ?? s.project) : "Portfolio"}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatValue(s.latest, s.unit)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                        {delta === null
                          ? "—"
                          : `${delta > 0 ? "+" : ""}${formatValue(delta, s.unit)}`}
                      </td>
                      <td className="py-2 pr-4">
                        <Sparkline points={s.points} />
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {s.source} · {formatDistanceToNow(new Date(s.asOf), { addSuffix: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No metrics recorded yet.</p>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Projects">
          <ul className="divide-y">
            {data.projects.map((p) => (
              <li key={p.slug} className="flex gap-3 py-2.5 text-sm">
                <Dot status={p.health} />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.stage}</span>
                  </div>
                  {p.focus && <div className="text-xs text-muted-foreground">{p.focus}</div>}
                  {p.next_milestone && (
                    <div className="text-xs text-muted-foreground">Next: {p.next_milestone}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Agents">
          <ul className="divide-y">
            {data.agents.map((a) => (
              <li key={a.id} className="flex gap-3 py-2.5 text-sm">
                <Dot status={a.status} />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.status.replace("_", " ")}
                    </span>
                    {a.last_activity_at && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(a.last_activity_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  {a.mission && <div className="text-xs text-muted-foreground">{a.mission}</div>}
                  {a.last_activity && (
                    <div className="text-xs">
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
      </div>
    </div>
  );
}
