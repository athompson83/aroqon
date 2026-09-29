"use client";

import { useOptimistic, useState, useTransition } from "react";
import { BellOff, Check, ExternalLink } from "lucide-react";

import { signalAction } from "@/lib/actions";
import type { Signal } from "@/lib/hq-types";
import { cn } from "@/lib/utils";

const SEVERITY = {
  critical: { dot: "bg-bad", label: "Critical", text: "text-bad" },
  warning: { dot: "bg-warn", label: "Warning", text: "text-warn" },
  info: { dot: "bg-primary", label: "Info", text: "text-primary" },
} as const;

// Open signals from every monitor, worst first. Resolving or muting one hides
// it at once; the monitor's next run reopens it if the problem is still there
// (muted ones stay muted).
export function Attention({
  signals,
  projectNames,
  sourceLabels,
  ages,
}: {
  signals: Signal[];
  projectNames: Record<string, string>;
  sourceLabels: Record<string, string>;
  ages: Record<string, string>;
}) {
  const [shown, hide] = useOptimistic(signals, (state, id: string) =>
    state.filter((s) => s.id !== id),
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function act(id: string, status: "resolved" | "muted") {
    startTransition(async () => {
      hide(id);
      const r = await signalAction({ id, status });
      setError(r.ok ? null : r.error);
    });
  }

  if (!shown.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-good" /> No open issues from any monitor.
      </p>
    );
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-bad">{error}</p>}
      <ul className="grid gap-2 lg:grid-cols-2 min-[1920px]:grid-cols-3">
        {shown.map((s) => {
          const sev = SEVERITY[s.severity];
          return (
            <li key={s.id} className="rounded-lg border bg-background p-3 text-sm">
              <div className="flex items-start gap-3">
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", sev.dot)} />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setOpenId(openId === s.id ? null : s.id)}
                >
                  <div className="font-medium">{s.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span className={sev.text}>{sev.label}</span>
                    {s.project_slug && (
                      <span>{projectNames[s.project_slug] ?? s.project_slug}</span>
                    )}
                    <span>{sourceLabels[s.source] ?? s.source}</span>
                    <span>seen {ages[s.id]} ago</span>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {s.url && /^https:\/\//.test(s.url) && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Open evidence"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => act(s.id, "resolved")}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-good"
                    title="Mark resolved (reopens if the monitor still sees it)"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => act(s.id, "muted")}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Mute (stays hidden even if reported again)"
                  >
                    <BellOff className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {openId === s.id && s.detail && (
                <p className="ml-5 mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                  {s.detail}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
