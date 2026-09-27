"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveTaskAction } from "@/lib/actions";
import type { Task } from "@/lib/hq-types";
import { cn } from "@/lib/utils";

const selectClass = "h-9 rounded-md border bg-background px-2 text-sm";

const GROUPS: { title: string; match: (t: Task) => boolean }[] = [
  { title: "Doing", match: (t) => t.status === "doing" },
  { title: "Blocked", match: (t) => t.status === "blocked" },
  { title: "Yours", match: (t) => t.status === "open" && t.owner === "owner" },
  { title: "Co-Founder & agents", match: (t) => t.status === "open" && t.owner !== "owner" },
  { title: "Done this week", match: (t) => t.status === "done" || t.status === "dropped" },
];

export function TodoBoard({
  tasks,
  projects,
}: {
  tasks: Task[];
  projects: { slug: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", project_slug: "", priority: "p2", due_on: "" });
  const [openId, setOpenId] = useState<string | null>(null);
  const names = new Map(projects.map((p) => [p.slug, p.name]));
  const today = new Date().toISOString().slice(0, 10);

  function save(input: Record<string, unknown>, after?: () => void) {
    startTransition(async () => {
      const r = await saveTaskAction(input);
      if (r.ok) {
        setError(null);
        after?.();
      } else setError(r.error);
    });
  }

  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap gap-2 rounded-xl border bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault();
          save(
            {
              title: draft.title,
              project_slug: draft.project_slug || null,
              priority: draft.priority,
              due_on: draft.due_on || null,
              owner: "owner",
            },
            () => setDraft({ ...draft, title: "", due_on: "" }),
          );
        }}
      >
        <Input
          className="min-w-[14rem] flex-1"
          placeholder="Add a to-do…"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <select
          className={selectClass}
          value={draft.project_slug}
          onChange={(e) => setDraft({ ...draft, project_slug: e.target.value })}
          aria-label="Project"
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={draft.priority}
          onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
          aria-label="Priority"
        >
          {["p0", "p1", "p2", "p3"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <Input
          type="date"
          className="w-40"
          value={draft.due_on}
          onChange={(e) => setDraft({ ...draft, due_on: e.target.value })}
          aria-label="Due date"
        />
        <Button type="submit" disabled={pending || !draft.title.trim()}>
          Add
        </Button>
      </form>
      {error && <p className="text-sm text-bad">{error}</p>}

      {GROUPS.map((g) => {
        const rows = tasks.filter(g.match);
        if (!rows.length) return null;
        return (
          <section key={g.title}>
            <h2 className="mb-2 text-sm font-semibold">
              {g.title} <span className="font-normal text-muted-foreground">{rows.length}</span>
            </h2>
            <ul className="divide-y rounded-xl border bg-card">
              {rows.map((t) => {
                const done = t.status === "done" || t.status === "dropped";
                return (
                  <li key={t.id} className="px-3 py-2.5">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-[var(--primary)]"
                        checked={done}
                        disabled={pending}
                        onChange={() => save({ id: t.id, status: done ? "open" : "done" })}
                        aria-label={done ? "Reopen" : "Mark done"}
                      />
                      <button
                        type="button"
                        className="flex-1 text-left text-sm"
                        onClick={() => setOpenId(openId === t.id ? null : t.id)}
                      >
                        <span className={cn(done && "text-muted-foreground line-through")}>
                          {t.title}
                        </span>
                        <span className="ml-2 font-mono text-xs uppercase text-muted-foreground">
                          {t.priority}
                        </span>
                        {t.project_slug && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {names.get(t.project_slug) ?? t.project_slug}
                          </span>
                        )}
                        {t.due_on && (
                          <span
                            className={cn(
                              "ml-2 text-xs",
                              !done && t.due_on < today ? "text-bad" : "text-muted-foreground",
                            )}
                          >
                            due {t.due_on}
                          </span>
                        )}
                      </button>
                      <select
                        className={cn(selectClass, "h-8")}
                        value={t.status}
                        disabled={pending}
                        onChange={(e) => save({ id: t.id, status: e.target.value })}
                        aria-label="Status"
                      >
                        {["open", "doing", "blocked", "done", "dropped"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    {openId === t.id && (
                      <div className="ml-7 mt-2 space-y-2 text-sm">
                        {t.detail && (
                          <p className="whitespace-pre-wrap text-muted-foreground">{t.detail}</p>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>Owner: {t.owner}</span>
                          <span>· Added by {t.created_by}</span>
                          {t.source && <span>· From {t.source}</span>}
                          {t.source_url && /^https:\/\//.test(t.source_url) && (
                            <a
                              className="underline"
                              href={t.source_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              · Evidence
                            </a>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <select
                            className={cn(selectClass, "h-8")}
                            value={t.priority}
                            disabled={pending}
                            onChange={(e) => save({ id: t.id, priority: e.target.value })}
                            aria-label="Priority"
                          >
                            {["p0", "p1", "p2", "p3"].map((p) => (
                              <option key={p}>{p}</option>
                            ))}
                          </select>
                          <select
                            className={cn(selectClass, "h-8")}
                            value={t.owner}
                            disabled={pending}
                            onChange={(e) => save({ id: t.id, owner: e.target.value })}
                            aria-label="Owner"
                          >
                            <option value="owner">Me</option>
                            <option value="cofounder">Co-Founder</option>
                            <option value="agent">An agent</option>
                          </select>
                          <Input
                            type="date"
                            className="h-8 w-40"
                            defaultValue={t.due_on ?? ""}
                            onBlur={(e) =>
                              e.target.value !== (t.due_on ?? "") &&
                              save({ id: t.id, due_on: e.target.value || null })
                            }
                            aria-label="Due date"
                          />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
