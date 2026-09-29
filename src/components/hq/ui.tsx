import { cn } from "@/lib/utils";

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-4 sm:p-5", className)}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {action && <div className="ml-auto text-xs text-muted-foreground">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "good" && "text-good",
          tone === "warn" && "text-warn",
          tone === "bad" && "text-bad",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const DOT = {
  green: "bg-good",
  on_track: "bg-good",
  yellow: "bg-warn",
  drifting: "bg-warn",
  idle: "bg-muted-foreground",
  red: "bg-bad",
  blocked: "bg-bad",
  unknown: "bg-border",
} as const;

export function Dot({ status }: { status: keyof typeof DOT }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", DOT[status])} />;
}

export function Sparkline({ points }: { points: { value: number }[] }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 26}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-24 text-primary">
      <polyline
        points={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
