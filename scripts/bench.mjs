// Mide el coste de leer entradas con RLS (sesión admin) frente a sin RLS (clave secreta).
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const opts = { auth: { persistSession: false }, realtime: { transport: ws } };
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, opts);
const admin = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
await admin.auth.signInWithPassword({ email: "admin@lapso.demo", password: "LapsoDemo2026!" });

async function time(label, client) {
  const t = Date.now();
  let rows = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("time_entries")
      .select("user_id, project_id, task_id, started_at, ended_at")
      .not("ended_at", "is", null)
      .order("started_at")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    rows += data.length;
    if (data.length < 1000) break;
  }
  console.log(`${label}: ${rows} filas en ${Date.now() - t} ms`);
}

await time("Sin RLS (service)", service);
await time("Con RLS (admin)  ", admin);
