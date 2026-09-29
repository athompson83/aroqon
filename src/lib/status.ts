import type { Series } from "./analytics";
import type { Brief, Project, Severity, Signal, Task } from "./hq-types";

// Everything here is derived at read time from what the monitors wrote, so the
// dashboard's statuses move the moment new data lands — nobody has to remember
// to flip a flag.

// Known report sources. A source not listed still shows, with a generic label
// and a two-day freshness window.
export const SOURCES: Record<string, { label: string; staleAfterHours: number }> = {
  cofounder: { label: "Co-Founder", staleAfterHours: 30 },
  codex: { label: "Codex readiness", staleAfterHours: 30 },
  "db-monitor": { label: "Database monitor", staleAfterHours: 30 },
  "actions-monitor": { label: "GitHub Actions monitor", staleAfterHours: 30 },
  "vercel-monitor": { label: "Vercel monitor", staleAfterHours: 30 },
};

export function sourceLabel(source: string): string {
  return (
    SOURCES[source]?.label ??
    source
      .split(/[-_.]/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ")
  );
}

const HOUR = 3_600_000;

export interface SourceReport {
  source: string;
  label: string;
  latest: Brief;
  count: number;
  stale: boolean;
  ageHours: number;
}

// The newest report from each source, known sources first in a fixed order,
// so the Codex readiness report is never buried under a smaller alert.
export function latestBySource(briefs: Brief[], nowMs: number): SourceReport[] {
  const groups = new Map<string, Brief[]>();
  for (const b of briefs) {
    const g = groups.get(b.source);
    if (g) g.push(b);
    else groups.set(b.source, [b]);
  }
  const order = Object.keys(SOURCES);
  return [...groups.entries()]
    .map(([source, rows]) => {
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      const latest = rows[0];
      const ageHours = (nowMs - Date.parse(latest.created_at)) / HOUR;
      const window = SOURCES[source]?.staleAfterHours ?? 48;
      return {
        source,
        label: sourceLabel(source),
        latest,
        count: rows.length,
        stale: ageHours > window,
        ageHours,
      };
    })
    .sort((a, b) => {
      const ia = order.indexOf(a.source);
      const ib = order.indexOf(b.source);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return b.latest.created_at.localeCompare(a.latest.created_at);
    });
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

export function openSignals(signals: Signal[]): Signal[] {
  return signals
    .filter((s) => s.status === "open")
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        b.last_seen.localeCompare(a.last_seen),
    );
}

export type Health = "green" | "yellow" | "red" | "unknown";
const HEALTH_RANK: Record<Health, number> = { red: 0, yellow: 1, green: 2, unknown: 3 };

export interface ProjectStatus {
  health: Health;
  reasons: string[];
  // True when the only evidence is an assessment older than three days.
  outdated: boolean;
}

function worst(a: Health, b: Health): Health {
  if (a === "unknown") return b;
  if (b === "unknown") return a;
  return HEALTH_RANK[a] <= HEALTH_RANK[b] ? a : b;
}

// A project's health is the worst of: the Co-Founder's last assessment (while
// it is fresh), its open signals, and its latest deploy metrics.
export function projectStatus(
  project: Project,
  signals: Signal[],
  series: Series[],
  nowMs: number,
): ProjectStatus {
  const reasons: string[] = [];
  const assessedAgoH = (nowMs - Date.parse(project.updated_at)) / HOUR;
  const assessmentFresh = assessedAgoH <= 72;
  let health: Health = assessmentFresh ? project.health : "unknown";

  const mine = openSignals(signals).filter((s) => s.project_slug === project.slug);
  const critical = mine.filter((s) => s.severity === "critical");
  const warnings = mine.filter((s) => s.severity === "warning");
  if (critical.length) {
    health = worst(health, "red");
    reasons.push(`${critical.length} critical issue${critical.length > 1 ? "s" : ""} open`);
  }
  if (warnings.length) {
    health = worst(health, "yellow");
    reasons.push(`${warnings.length} warning${warnings.length > 1 ? "s" : ""} open`);
  }

  for (const s of series) {
    if (s.project !== project.slug) continue;
    if (s.metric === "prod_deploy_ok" && s.latest === 0) {
      health = worst(health, "red");
      reasons.push("Latest production deploy is not READY");
    }
    if (s.metric === "vercel.consecutive_production_errors" && s.latest > 0) {
      health = worst(health, "red");
      reasons.push(`${s.latest} production builds failing in a row`);
    }
    if (s.metric === "vercel.production_commit_drift_behind" && s.latest > 0) {
      health = worst(health, "yellow");
      reasons.push(`Production is ${s.latest} commits behind main`);
    }
  }

  if (!mine.length && health === "unknown" && !assessmentFresh) {
    reasons.push("No assessment in the last 3 days");
  }
  return { health, reasons, outdated: !assessmentFresh && reasons.length === 0 };
}

export const STALE_TASK_DAYS = 14;

// The owner's open work that nothing has touched for two weeks. The database
// drops idle agent tasks itself; the owner's are only flagged, never closed.
export function isStaleTask(task: Task, nowMs: number): boolean {
  if (task.status !== "open" && task.status !== "blocked") return false;
  return nowMs - Date.parse(task.updated_at) > STALE_TASK_DAYS * 24 * HOUR;
}

export function ageLabel(iso: string, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
