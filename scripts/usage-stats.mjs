// Mide el tamaño real de la base de datos y el espacio por entrada (usa usage_db_stats, migración 0003).
// Uso: node --env-file=.env.local scripts/usage-stats.mjs
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const opts = { auth: { persistSession: false }, realtime: { transport: ws } };
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
await admin.auth.signInWithPassword({ email: "admin@lapso.demo", password: "LapsoDemo2026!" });

const { data, error } = await admin.rpc("usage_db_stats");
if (error) throw error;
const { count } = await admin.from("time_entries").select("id", { count: "exact", head: true });
const { count: people } = await admin.from("profiles").select("id", { count: "exact", head: true });

const mb = (b) => (b / 1024 / 1024).toFixed(2) + " MB";
console.log("Base de datos total:", mb(data.db_bytes));
for (const t of data.tables) console.log(`  ${t.name.padEnd(18)} ${mb(t.bytes).padStart(10)}  ~${t.rows} filas`);
const entryBytes = data.tables.filter((t) => ["time_entries", "time_entry_audit"].includes(t.name)).reduce((s, t) => s + t.bytes, 0);
console.log("Entradas:", count, "· personas:", people);
console.log("Bytes por entrada (con auditoría e índices):", Math.round(entryBytes / count));
