// Mide la lectura de entradas: tabla paginada con RLS vs función report_entries() (migración 0002).
// Uso: node --env-file=.env.local scripts/bench.mjs
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const opts = { auth: { persistSession: false }, realtime: { transport: ws } };
const admin = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
await admin.auth.signInWithPassword({ email: "admin@lapso.demo", password: "LapsoDemo2026!" });

let t = Date.now();
let rows = 0;
for (let from = 0; ; from += 1000) {
  const { data, error } = await admin
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
console.log(`Tabla paginada (RLS): ${rows} filas en ${Date.now() - t} ms`);

t = Date.now();
const { data, error } = await admin.rpc("report_entries", {});
if (error) console.log("report_entries no disponible:", error.message);
else console.log(`report_entries():   ${data.length} filas en ${Date.now() - t} ms`);
