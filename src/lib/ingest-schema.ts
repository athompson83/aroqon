import { z } from "zod";

// The one shape every outside reporter sends: Codex, the database monitor,
// the GitHub Actions monitor, the Vercel monitor, or anything added later.
// Documented with examples in docs/INGEST.md.

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{0,40}$/, "a short lowercase slug");
const text = (max: number) => z.string().trim().min(1).max(max);
const httpsUrl = z
  .string()
  .max(2000)
  .refine((u) => {
    try {
      return new URL(u).protocol === "https:";
    } catch {
      return false;
    }
  }, "an https URL");

export const IngestPayload = z
  .object({
    source: slug,
    // True when `signals` is everything this source currently sees; the rest
    // of its open signals are then resolved.
    complete: z.boolean().default(false),
    reports: z
      .array(
        z.object({
          kind: z.enum(["daily", "weekly", "adhoc"]).default("daily"),
          headline: text(300),
          body_md: text(100_000),
          project_slug: slug.optional(),
        }),
      )
      .max(10)
      .default([]),
    signals: z
      .array(
        z.object({
          fingerprint: text(200),
          severity: z.enum(["critical", "warning", "info"]).default("warning"),
          title: text(300),
          detail: z.string().max(4000).optional(),
          project_slug: slug.optional(),
          url: httpsUrl.optional(),
        }),
      )
      .max(500)
      .default([]),
    metrics: z
      .array(
        z.object({
          metric: z.string().regex(/^[a-z0-9_.]{1,80}$/, "lowercase, digits, _ and ."),
          value: z.number().finite(),
          unit: z.enum(["usd", "pct", "count"]).optional(),
          project_slug: slug.optional(),
          as_of: z.iso.datetime({ offset: true }).optional(),
        }),
      )
      .max(500)
      .default([]),
    tasks: z
      .array(
        z.object({
          title: text(300),
          detail: z.string().max(4000).optional(),
          project_slug: slug.optional(),
          owner: z.enum(["owner", "cofounder", "agent"]).default("owner"),
          priority: z.enum(["p0", "p1", "p2", "p3"]).default("p2"),
          source_url: httpsUrl.optional(),
          signal_fingerprint: text(200).optional(),
        }),
      )
      .max(100)
      .default([]),
  })
  .refine(
    (p) =>
      p.reports.length + p.signals.length + p.metrics.length + p.tasks.length > 0 || p.complete,
    "send at least one report, signal, metric or task (or complete: true to clear)",
  );
export type IngestPayload = z.infer<typeof IngestPayload>;
