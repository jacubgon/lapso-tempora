// Prueba E2E: deja a Ana con un cronómetro en marcha desde ayer a las 15:30 (día laborable).
// Uso: node --env-file=.env.local scripts/e2e-forgotten.mjs
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

const { data: ana } = await db.from("profiles").select("id").eq("email", "ana@lapso.demo").single();
const { data: member } = await db.from("project_members").select("project_id").eq("user_id", ana.id).limit(1).single();
await db.from("time_entries").delete().eq("user_id", ana.id).is("ended_at", null);

const y = new Date();
y.setDate(y.getDate() - 1);
while (y.getDay() === 0 || y.getDay() === 6) y.setDate(y.getDate() - 1);
y.setHours(15, 30, 0, 0);

const { error } = await db.from("time_entries").insert({
  user_id: ana.id,
  title: "Ajustes de diseño",
  project_id: member.project_id,
  started_at: y.toISOString(),
  source: "timer",
});
console.log(error ? `✖ ${error.message}` : `✔ Cronómetro olvidado desde ${y.toLocaleString("es-ES")}`);
