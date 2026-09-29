import "server-only";
import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  HQ_DB_KEY: z.string().min(32),
  HQ_SESSION_SECRET: z.string().min(32),
  HQ_OWNER_EMAIL: z.email(),
  HQ_SIGNIN_FROM: z.string().min(3),
  HQ_BASE_URL: z.url(),
  RESEND_API_KEY: z.string().startsWith("re_"),
  // Bearer token for POST /api/ingest. Unset means the endpoint is closed.
  HQ_INGEST_TOKEN: z.string().min(32).optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// Read lazily so `next build` does not need production secrets.
export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
