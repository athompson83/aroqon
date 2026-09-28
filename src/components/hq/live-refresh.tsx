"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

const INTERVAL_MS = 20_000;

// Re-renders the server components on a timer, so a task the Co-Founder or an
// agent moves — or one changed in another tab — shows up without a reload.
// Paused while the tab is hidden; refreshes at once when it comes back.
export function LiveRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
      setUpdatedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    };
    const timer = window.setInterval(refresh, INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  return (
    <span
      className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"
      title="HQ refreshes itself every 20 seconds while this tab is open"
    >
      <span className={cn("h-2 w-2 rounded-full bg-good", pending && "animate-pulse")} />
      Live{updatedAt && ` · ${updatedAt}`}
    </span>
  );
}
