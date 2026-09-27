import { describe, expect, it } from "vitest";
import { formatValue, portfolioTotal, seriesFrom, taskStats } from "@/lib/analytics";
import type { Metric, Task } from "@/lib/hq-types";

const metric = (over: Partial<Metric>): Metric => ({
  id: 1,
  metric: "open_prs",
  project_slug: "captivate",
  value: 1,
  unit: null,
  source: "github",
  as_of: "2026-09-27T00:00:00Z",
  ...over,
});

describe("seriesFrom", () => {
  it("groups by metric and project and keeps the latest and previous", () => {
    const s = seriesFrom([
      metric({ id: 2, value: 5, as_of: "2026-09-27T00:00:00Z" }),
      metric({ id: 1, value: 3, as_of: "2026-09-26T00:00:00Z" }),
      metric({ id: 3, project_slug: "rise", value: 2 }),
    ]);
    expect(s).toHaveLength(2);
    const cap = s.find((x) => x.project === "captivate")!;
    expect(cap).toMatchObject({ latest: 5, previous: 3 });
    expect(cap.points.map((p) => p.value)).toEqual([3, 5]);
    expect(portfolioTotal(s, "open_prs")).toBe(7);
    expect(portfolioTotal(s, "mrr")).toBeNull();
  });
});

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
  created_at: "2026-09-20T00:00:00Z",
  updated_at: "2026-09-20T00:00:00Z",
  completed_at: null,
  ...over,
});

describe("taskStats", () => {
  it("counts open, overdue, blocked and recently done", () => {
    const stats = taskStats(
      [
        task({ priority: "p0", due_on: "2026-09-26" }),
        task({ status: "blocked", owner: "cofounder" }),
        task({ status: "done", completed_at: "2026-09-25T00:00:00Z" }),
        task({ status: "done", completed_at: "2026-09-01T00:00:00Z" }),
      ],
      "2026-09-27",
    );
    expect(stats).toEqual({ open: 2, p0: 1, overdue: 1, blocked: 1, mine: 1, doneThisWeek: 1 });
  });
});

describe("formatValue", () => {
  it("formats currency and percentages", () => {
    expect(formatValue(1234, "usd")).toBe("$1,234");
    expect(formatValue(0.256, "pct")).toBe("25.6%");
    expect(formatValue(42, null)).toBe("42");
  });
});
