"use client";

import { useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface ReportTab {
  source: string;
  label: string;
  headline: string;
  age: string;
  stale: boolean;
  id: string;
  body: React.ReactNode;
}

// One tab per source — Co-Founder, Codex, each monitor — showing its newest
// report. A dot marks a source that has gone quiet past its reporting window.
export function ReportsPanel({ tabs }: { tabs: ReportTab[] }) {
  const [active, setActive] = useState(tabs[0]?.source ?? "");
  const [expanded, setExpanded] = useState(false);
  const tab = tabs.find((t) => t.source === active) ?? tabs[0];

  if (!tab) {
    return <p className="text-sm text-muted-foreground">No reports yet.</p>;
  }

  return (
    <div>
      <div className="-mx-1 mb-3 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.source}
            type="button"
            onClick={() => {
              setActive(t.source);
              setExpanded(false);
            }}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs",
              t.source === tab.source
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full", t.stale ? "bg-warn" : "bg-good")}
              title={t.stale ? "Overdue" : "Up to date"}
            />
            {t.label}
            <span className="opacity-70">{t.age}</span>
          </button>
        ))}
      </div>
      <h3 className="text-base font-semibold leading-snug">{tab.headline}</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        {tab.label} · {tab.age} ago
        {tab.stale && (
          <span className="text-warn"> · overdue — this source has not reported on schedule</span>
        )}
      </p>
      <div className={cn("relative", !expanded && "max-h-[28rem] overflow-hidden")}>
        {tab.body}
        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card" />
        )}
      </div>
      <div className="mt-2 flex gap-4 text-xs">
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Collapse" : "Show all"}
        </button>
        <Link
          href={`/reports?source=${encodeURIComponent(tab.source)}`}
          className="text-primary hover:underline"
        >
          History →
        </Link>
      </div>
    </div>
  );
}
