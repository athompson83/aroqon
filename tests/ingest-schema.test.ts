import { describe, expect, it } from "vitest";
import { IngestPayload } from "@/lib/ingest-schema";

describe("IngestPayload", () => {
  it("accepts a Codex readiness report with defaults filled in", () => {
    const p = IngestPayload.parse({
      source: "Codex",
      reports: [{ headline: "Four-App Readiness", body_md: "| a | b |\n|---|---|" }],
    });
    expect(p.source).toBe("codex");
    expect(p.reports[0].kind).toBe("daily");
    expect(p.complete).toBe(false);
  });

  it("accepts a complete monitor run with signals, metrics and a linked task", () => {
    const p = IngestPayload.parse({
      source: "vercel-monitor",
      complete: true,
      signals: [
        {
          fingerprint: "kynomy/prod-build-failing",
          severity: "critical",
          title: "Kynomy production builds failing",
          project_slug: "kynomy",
          url: "https://vercel.com/x",
        },
      ],
      metrics: [
        {
          metric: "vercel.consecutive_production_errors",
          value: 15,
          unit: "count",
          project_slug: "kynomy",
        },
      ],
      tasks: [{ title: "Fix Kynomy build", signal_fingerprint: "kynomy/prod-build-failing" }],
    });
    expect(p.signals[0].severity).toBe("critical");
    expect(p.tasks[0]).toMatchObject({ owner: "owner", priority: "p2" });
  });

  it("allows an empty complete run, which clears a source's open signals", () => {
    expect(IngestPayload.safeParse({ source: "db-monitor", complete: true }).success).toBe(true);
  });

  it("rejects bad input", () => {
    const bad = [
      {},
      { source: "x" },
      { source: "has spaces", reports: [{ headline: "h", body_md: "b" }] },
      { source: "s", signals: [{ fingerprint: "f", title: "t", url: "javascript:alert(1)" }] },
      { source: "s", signals: [{ fingerprint: "f", title: "t", severity: "panic" }] },
      { source: "s", metrics: [{ metric: "Bad Name", value: 1 }] },
      { source: "s", metrics: [{ metric: "ok", value: Number.NaN }] },
    ];
    for (const b of bad) expect(IngestPayload.safeParse(b).success).toBe(false);
  });
});
