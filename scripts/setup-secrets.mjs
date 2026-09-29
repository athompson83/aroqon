// Generates HQ's two secrets and the SQL that registers the database key.
// Run it on your own machine: `node scripts/setup-secrets.mjs`. Nothing is
// sent anywhere; paste the values into Vercel and run the SQL in Supabase.
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const dbKey = randomBytes(32).toString("base64url");
const sessionSecret = randomBytes(32).toString("base64url");
const hash = bcrypt.hashSync(dbKey, 10);

console.log(`# 1. Vercel → project "aroqon" → Settings → Environment Variables (Production, Sensitive):
HQ_DB_KEY=${dbKey}
HQ_SESSION_SECRET=${sessionSecret}

# 2. Supabase → project data-foundry (fgxinxaqkwoqyywdgobs) → SQL editor.
#    The hash is not a secret; you can also paste this line to the Co-Founder.
insert into hq.gateway_keys (label, key_hash) values ('aroqon-hq dashboard (Vercel)', '${hash}');
`);
