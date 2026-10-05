// Ajustes de la demo: ciclo de reunión cada 14 días (las reuniones del seed caen en lunes alternos).
// Uso: node --env-file=.env.local scripts/demo-settings.mjs [YYYY-MM-DD]
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

const anchor = process.argv[2] ?? "2026-09-21";
const { data, error } = await db
  .from("app_settings")
  .update({ cycle_anchor: anchor, cycle_days: 14 })
  .eq("id", 1)
  .select("cycle_anchor, cycle_days, lock_before")
  .single();
if (error) {
  console.error("✖", error.message);
  process.exit(1);
}
console.log("✔ Ajustes:", data);
