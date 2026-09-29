import "server-only";
import { env } from "./env";
import { Dashboard, Signal, Task, Triage, type TaskInput } from "./hq-types";

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const e = env();
  const res = await fetch(`${e.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: e.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${e.SUPABASE_PUBLISHABLE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_key: e.HQ_DB_KEY, ...args }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`hq ${fn} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

export async function loadDashboard(): Promise<Dashboard> {
  return Dashboard.parse(await rpc("hq_dashboard", {}));
}

export async function saveTask(task: TaskInput) {
  return Task.parse(await rpc("hq_task_save", { p_task: task }));
}

export async function saveTriage(triage: {
  email_id: string;
  direction: "received" | "sent";
  category?: string;
  priority?: "urgent" | "normal" | "low";
  handled?: boolean;
}) {
  return Triage.parse(await rpc("hq_triage_save", { p_triage: triage }));
}

export async function consumeNonce(nonce: string): Promise<boolean> {
  return (await rpc("hq_consume_nonce", { p_nonce: nonce })) === true;
}

export async function setSignalStatus(id: string, status: "open" | "resolved" | "muted") {
  return Signal.parse(await rpc("hq_signal_set", { p_id: id, p_status: status }));
}

export async function ingest(payload: unknown): Promise<unknown> {
  return rpc("hq_ingest", { p_payload: payload });
}
