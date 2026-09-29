import { TodoBoard } from "@/components/hq/todo-board";
import { loadDashboard } from "@/lib/hq";
import { isStaleTask } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function TodoPage() {
  const data = await loadDashboard();
  const now = Date.now();
  return (
    <div className="mx-auto w-full max-w-[2400px] p-4 sm:p-6 2xl:px-10">
      <TodoBoard
        tasks={data.tasks}
        projects={data.projects.map((p) => ({ slug: p.slug, name: p.name }))}
        staleIds={data.tasks
          .filter((t) => t.owner === "owner" && isStaleTask(t, now))
          .map((t) => t.id)}
      />
    </div>
  );
}
