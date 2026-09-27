import type { Agent, Metric, Task } from "./hq-types";

export interface Series {
  metric: string;
  project: string | null;
  unit: string | null;
  source: string;
  latest: number;
  previous: number | null;
  asOf: string;
  points: { at: string; value: number }[];
}

// Metrics arrive as snapshots the Co-Founder records from GitHub, Vercel,
// Stripe and Resend. A series is one metric for one project over time.
export function seriesFrom(metrics: Metric[]): Series[] {
  const groups = new Map<string, Metric[]>();
  for (const m of metrics) {
    const key = `${m.metric}\u0000${m.project_slug ?? ""}`;
    const g = groups.get(key);
    if (g) g.push(m);
    else groups.set(key, [m]);
  }
  return [...groups.values()]
    .map((rows) => {
      rows.sort((a, b) => a.as_of.localeCompare(b.as_of));
      const last = rows[rows.length - 1];
      const prev = rows.length > 1 ? rows[rows.length - 2] : null;
      return {
        metric: last.metric,
        project: last.project_slug,
        unit: last.unit,
        source: last.source,
        latest: last.value,
        previous: prev?.value ?? null,
        asOf: last.as_of,
        points: rows.map((r) => ({ at: r.as_of, value: r.value })),
      };
    })
    .sort(
      (a, b) =>
        a.metric.localeCompare(b.metric) || (a.project ?? "").localeCompare(b.project ?? ""),
    );
}

// Portfolio totals: the sum of the latest per-project values of a metric.
export function portfolioTotal(series: Series[], metric: string): number | null {
  const rows = series.filter((s) => s.metric === metric);
  if (!rows.length) return null;
  return rows.reduce((sum, s) => sum + s.latest, 0);
}

export interface TaskStats {
  open: number;
  p0: number;
  overdue: number;
  blocked: number;
  mine: number;
  doneThisWeek: number;
}

export function taskStats(tasks: Task[], today: string): TaskStats {
  const live = tasks.filter((t) => t.status !== "done" && t.status !== "dropped");
  const weekAgo = new Date(new Date(today).getTime() - 7 * 86_400_000).toISOString();
  return {
    open: live.length,
    p0: live.filter((t) => t.priority === "p0").length,
    overdue: live.filter((t) => t.due_on !== null && t.due_on < today).length,
    blocked: live.filter((t) => t.status === "blocked").length,
    mine: live.filter((t) => t.owner === "owner").length,
    doneThisWeek: tasks.filter((t) => t.status === "done" && (t.completed_at ?? "") >= weekAgo)
      .length,
  };
}

export function agentStats(agents: Agent[]) {
  const counts = { on_track: 0, drifting: 0, blocked: 0, idle: 0, unknown: 0 };
  for (const a of agents) counts[a.status]++;
  return counts;
}

export function formatValue(value: number, unit: string | null): string {
  if (unit === "usd") {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: value >= 100 ? 0 : 2,
    });
  }
  if (unit === "pct") return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString("en-US");
}
