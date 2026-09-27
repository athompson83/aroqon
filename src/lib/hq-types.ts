import { z } from "zod";

// Everything the database hands back is parsed, never trusted: the agent writes
// these rows through raw SQL, so a typo there must not take the dashboard down.
// `catch` keeps one bad row from blanking a whole panel.

export const Priority = z.enum(["p0", "p1", "p2", "p3"]);
export const TaskStatus = z.enum(["open", "doing", "blocked", "done", "dropped"]);
export const TaskOwner = z.enum(["owner", "cofounder", "agent"]);

export const Task = z.object({
  id: z.uuid(),
  title: z.string(),
  detail: z.string().nullable(),
  project_slug: z.string().nullable(),
  owner: TaskOwner,
  priority: Priority,
  status: TaskStatus,
  due_on: z.string().nullable(),
  source: z.string().nullable(),
  source_url: z.string().nullable(),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
});
export type Task = z.infer<typeof Task>;

export const Project = z.object({
  slug: z.string(),
  name: z.string(),
  repo: z.string().nullable(),
  url: z.string().nullable(),
  stage: z.enum(["idea", "build", "beta", "live", "paused", "retired"]),
  health: z.enum(["green", "yellow", "red", "unknown"]),
  focus: z.string().nullable(),
  next_milestone: z.string().nullable(),
  updated_at: z.string(),
});
export type Project = z.infer<typeof Project>;

export const Agent = z.object({
  id: z.string(),
  name: z.string(),
  project_slug: z.string().nullable(),
  mission: z.string().nullable(),
  status: z.enum(["on_track", "drifting", "blocked", "idle", "unknown"]),
  last_activity_at: z.string().nullable(),
  last_activity: z.string().nullable(),
  evidence_url: z.string().nullable(),
  updated_at: z.string(),
});
export type Agent = z.infer<typeof Agent>;

export const Metric = z.object({
  id: z.number(),
  metric: z.string(),
  project_slug: z.string().nullable(),
  value: z.coerce.number(),
  unit: z.string().nullable(),
  source: z.string(),
  as_of: z.string(),
});
export type Metric = z.infer<typeof Metric>;

export const Brief = z.object({
  id: z.uuid(),
  kind: z.enum(["daily", "weekly", "adhoc"]),
  headline: z.string(),
  body_md: z.string(),
  created_at: z.string(),
});
export type Brief = z.infer<typeof Brief>;

export const Triage = z.object({
  email_id: z.string(),
  direction: z.enum(["received", "sent"]),
  category: z.string(),
  priority: z.enum(["urgent", "normal", "low"]),
  summary: z.string().nullable(),
  action: z.string().nullable(),
  task_id: z.string().nullable(),
  handled: z.boolean(),
  updated_at: z.string(),
});
export type Triage = z.infer<typeof Triage>;

function lenientArray<T extends z.ZodType>(item: T) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((rows) =>
      rows.flatMap((row) => {
        const parsed = item.safeParse(row);
        return parsed.success ? [parsed.data as z.infer<T>] : [];
      }),
    );
}

export const Dashboard = z.object({
  projects: lenientArray(Project),
  tasks: lenientArray(Task),
  agents: lenientArray(Agent),
  metrics: lenientArray(Metric),
  briefs: lenientArray(Brief),
  triage: lenientArray(Triage),
});
export type Dashboard = z.infer<typeof Dashboard>;

export const TaskInput = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1).max(300).optional(),
  detail: z.string().max(4000).nullable().optional(),
  project_slug: z.string().max(64).nullable().optional(),
  owner: TaskOwner.optional(),
  priority: Priority.optional(),
  status: TaskStatus.optional(),
  due_on: z.iso.date().nullable().optional(),
});
export type TaskInput = z.infer<typeof TaskInput>;
