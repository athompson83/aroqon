import { describe, expect, it } from "vitest";
import { Dashboard } from "@/lib/hq-types";

describe("Dashboard parsing", () => {
  // The agent writes rows with raw SQL. One bad row must cost that row, not the page.
  it("drops malformed rows instead of failing the whole dashboard", () => {
    const parsed = Dashboard.parse({
      projects: [
        {
          slug: "rise",
          name: "Rise",
          repo: null,
          url: null,
          stage: "live",
          health: "green",
          focus: null,
          next_milestone: null,
          updated_at: "x",
        },
        { slug: "bad", name: "Bad", stage: "not-a-stage" },
      ],
      tasks: "not an array",
      agents: [],
      metrics: [
        {
          id: 1,
          metric: "m",
          project_slug: null,
          value: "12.5",
          unit: null,
          source: "s",
          as_of: "x",
        },
      ],
      briefs: null,
      triage: [],
    });
    expect(parsed.projects.map((p) => p.slug)).toEqual(["rise"]);
    expect(parsed.tasks).toEqual([]);
    expect(parsed.briefs).toEqual([]);
    expect(parsed.metrics[0].value).toBe(12.5);
  });
});
