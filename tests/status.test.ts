import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/analytics";
import type { Brief, Project, Signal, Task } from "@/lib/hq-types";
import {
  ageLabel,
  isStaleTask,
  latestBySource,
  openSignals,
  projectStatus,
  sourceLabel,
} from "@/lib/status";

const NOW = Date.parse("2026-09-29T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const brief = (over: Partial<Brief>): Brief => ({
  id: crypto.randomUUID(),
  kind: "daily",
  source: "cofounder",
  project_slug: null,
  headline: "h",
  body_md: "b",
  created_at: hoursAgo(1),
  ...over,
});

const signal = (over: Partial<Signal>): Signal => ({
  id: crypto.randomUUID(),
  source: "vercel-monitor",
  fingerprint: "fp",
  project_slug: "kynomy",
  severity: "warning",
  title: "t",
  detail: null,
  url: null,
  status: "open",
  first_seen: hoursAgo(5),
  last_seen: hoursAgo(1),
  resolved_at: null,
  resolution: null,
  ...over,
});

const project = (over: Partial<Project>): Project => ({
  slug: "kynomy",
  name: "Kynomy",
  repo: null,
  url: null,
  stage: "beta",
  health: "green",
  focus: null,
  next_milestone: null,
  updated_at: hoursAgo(2),
  ...over,
});

const series = (over: Partial<Series>): Series => ({
  metric: "prod_deploy_ok",
  project: "kynomy",
  unit: null,
  source: "vercel",
  latest: 1,
  previous: null,
  asOf: hoursAgo(1),
  points: [],
  ...over,
});

describe("latestBySource", () => {
  it("keeps the newest report per source and puts known sources first", () => {
    const rows = latestBySource(
      [
        brief({ source: "vercel-monitor", created_at: hoursAgo(1), headline: "small alert" }),
        brief({ source: "codex", created_at: hoursAgo(3), headline: "readiness" }),
        brief({ source: "codex", created_at: hoursAgo(27), headline: "old readiness" }),
        brief({ source: "zzz-custom", created_at: hoursAgo(2) }),
      ],
      NOW,
    );
    expect(rows.map((r) => r.source)).toEqual(["codex", "vercel-monitor", "zzz-custom"]);
    expect(rows[0]).toMatchObject({ count: 2, stale: false, label: "Codex readiness" });
    expect(rows[0].latest.headline).toBe("readiness");
  });

  it("marks a source stale once it misses its reporting window", () => {
    const [row] = latestBySource([brief({ source: "db-monitor", created_at: hoursAgo(31) })], NOW);
    expect(row.stale).toBe(true);
  });
});

describe("sourceLabel", () => {
  it("names unknown sources from their slug", () => {
    expect(sourceLabel("stripe-monitor")).toBe("Stripe Monitor");
  });
});

describe("openSignals", () => {
  it("lists open signals critical first, newest first within a severity", () => {
    const list = openSignals([
      signal({
        id: "00000000-0000-4000-8000-000000000001",
        severity: "warning",
        last_seen: hoursAgo(1),
      }),
      signal({
        id: "00000000-0000-4000-8000-000000000002",
        severity: "critical",
        last_seen: hoursAgo(5),
      }),
      signal({
        id: "00000000-0000-4000-8000-000000000003",
        severity: "warning",
        last_seen: hoursAgo(0),
      }),
      signal({ id: "00000000-0000-4000-8000-000000000004", status: "resolved" }),
    ]);
    expect(list.map((s) => s.id.slice(-1))).toEqual(["2", "3", "1"]);
  });
});

describe("projectStatus", () => {
  it("turns red on a critical signal even if the last assessment was green", () => {
    const s = projectStatus(project({}), [signal({ severity: "critical" })], [], NOW);
    expect(s.health).toBe("red");
    expect(s.reasons).toContain("1 critical issue open");
  });

  it("turns red when the latest deploy metric is failing", () => {
    const s = projectStatus(
      project({}),
      [],
      [
        series({ latest: 0 }),
        series({ metric: "vercel.consecutive_production_errors", latest: 15 }),
      ],
      NOW,
    );
    expect(s.health).toBe("red");
    expect(s.reasons).toEqual([
      "Latest production deploy is not READY",
      "15 production builds failing in a row",
    ]);
  });

  it("stops trusting an assessment older than three days", () => {
    const s = projectStatus(project({ health: "green", updated_at: hoursAgo(100) }), [], [], NOW);
    expect(s.health).toBe("unknown");
    expect(s.reasons).toEqual(["No assessment in the last 3 days"]);
  });

  it("recovers to the assessment once signals resolve", () => {
    const s = projectStatus(
      project({ health: "green" }),
      [signal({ status: "resolved" })],
      [],
      NOW,
    );
    expect(s).toEqual({ health: "green", reasons: [], outdated: false });
  });
});

describe("isStaleTask", () => {
  const task = (over: Partial<Task>): Task => ({
    id: "00000000-0000-4000-8000-000000000000",
    title: "t",
    detail: null,
    project_slug: null,
    owner: "owner",
    priority: "p2",
    status: "open",
    due_on: null,
    source: null,
    source_url: null,
    created_by: "owner",
    created_at: hoursAgo(400),
    updated_at: hoursAgo(15 * 24),
    completed_at: null,
    ...over,
  });

  it("flags open work untouched for two weeks, and nothing else", () => {
    expect(isStaleTask(task({}), NOW)).toBe(true);
    expect(isStaleTask(task({ updated_at: hoursAgo(24) }), NOW)).toBe(false);
    expect(isStaleTask(task({ status: "doing" }), NOW)).toBe(false);
    expect(isStaleTask(task({ status: "done" }), NOW)).toBe(false);
  });
});

describe("ageLabel", () => {
  it("reads minutes, hours then days", () => {
    expect(ageLabel(hoursAgo(0.5), NOW)).toBe("30m");
    expect(ageLabel(hoursAgo(5), NOW)).toBe("5h");
    expect(ageLabel(hoursAgo(72), NOW)).toBe("3d");
  });
});
