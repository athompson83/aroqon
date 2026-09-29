import Link from "next/link";
import { format } from "date-fns";

import { Markdown } from "@/components/hq/markdown";
import { loadDashboard } from "@/lib/hq";
import { ageLabel, latestBySource, sourceLabel } from "@/lib/status";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Every current report from every source: pick a source on the left, a report
// in the list, and read it full width. Reports older than 14 days are archived
// automatically, except each source's latest.
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; id?: string }>;
}) {
  const { source, id } = await searchParams;
  const data = await loadDashboard();
  const nowMs = Date.now();
  const sources = latestBySource(data.briefs, nowMs);
  const activeSource = source && sources.some((s) => s.source === source) ? source : null;
  const list = data.briefs
    .filter((b) => !activeSource || b.source === activeSource)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const selected = list.find((b) => b.id === id) ?? list[0];
  const projectName = Object.fromEntries(data.projects.map((p) => [p.slug, p.name]));
  const href = (q: { source?: string | null; id?: string }) => {
    const p = new URLSearchParams();
    if (q.source) p.set("source", q.source);
    if (q.id) p.set("id", q.id);
    const s = p.toString();
    return s ? `/reports?${s}` : "/reports";
  };

  return (
    <div className="mx-auto grid w-full max-w-[2400px] gap-6 p-4 sm:p-6 lg:grid-cols-[16rem_22rem_1fr] 2xl:px-10">
      <aside className="space-y-1">
        <h2 className="mb-2 text-sm font-semibold">Sources</h2>
        <Link
          href={href({})}
          className={cn(
            "block rounded-md px-3 py-2 text-sm",
            !activeSource ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent",
          )}
        >
          All sources
        </Link>
        {sources.map((s) => (
          <Link
            key={s.source}
            href={href({ source: s.source })}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
              activeSource === s.source
                ? "bg-accent font-medium"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", s.stale ? "bg-warn" : "bg-good")} />
            <span className="flex-1">{s.label}</span>
            <span className="text-xs">{ageLabel(s.latest.created_at, nowMs)}</span>
          </Link>
        ))}
        <p className="px-3 pt-3 text-xs text-muted-foreground">
          An amber dot means the source is overdue for its next report.
        </p>
      </aside>

      <ul className="max-h-[calc(100vh-7rem)] space-y-1 overflow-y-auto lg:sticky lg:top-20">
        {list.map((b) => (
          <li key={b.id}>
            <Link
              href={href({ source: activeSource, id: b.id })}
              className={cn(
                "block rounded-lg border p-3 text-sm",
                selected?.id === b.id ? "border-primary bg-card" : "bg-card/50 hover:bg-card",
              )}
            >
              <div className="line-clamp-2 font-medium">{b.headline}</div>
              <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                <span>{sourceLabel(b.source)}</span>
                <span>{b.kind}</span>
                {b.project_slug && <span>{projectName[b.project_slug] ?? b.project_slug}</span>}
                <span>{ageLabel(b.created_at, nowMs)} ago</span>
              </div>
            </Link>
          </li>
        ))}
        {!list.length && <li className="text-sm text-muted-foreground">No reports.</li>}
      </ul>

      <article className="min-w-0 rounded-xl border bg-card p-5 sm:p-8">
        {selected ? (
          <>
            <p className="text-xs text-muted-foreground">
              {sourceLabel(selected.source)} · {selected.kind} ·{" "}
              {format(new Date(selected.created_at), "PPpp")}
            </p>
            <h1 className="mb-4 mt-1 text-xl font-semibold leading-snug">{selected.headline}</h1>
            <Markdown source={selected.body_md} className="max-w-none text-[15px]" />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing to show.</p>
        )}
      </article>
    </div>
  );
}
