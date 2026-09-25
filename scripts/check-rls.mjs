// Comprobación de reglas de seguridad (RLS + triggers) con usuarios demo.
// Uso: node --env-file=.env.local scripts/check-rls.mjs
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "LapsoDemo2026!";
const opts = { auth: { persistSession: false }, realtime: { transport: ws } };

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "✔" : "✖"} ${msg}`);
  if (!ok) failed++;
};

async function as(email) {
  const c = createClient(url, anon, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { c, id: data.user.id };
}

const ana = await as("ana@lapso.demo");
const admin = await as("admin@lapso.demo");

// Proyectos visibles para Ana
const { data: projects } = await ana.c.from("projects").select("id, name");
const names = projects.map((p) => p.name).sort();
check(!names.includes("Mantenimiento") && names.length === 4, `Ana ve solo sus proyectos: ${names.join(", ")}`);

const web = projects.find((p) => p.name === "Web corporativa");
const { data: allProjects } = await admin.c.from("projects").select("id, name");
const mant = allProjects.find((p) => p.name === "Mantenimiento");
check(allProjects.length === 5, "Admin ve todos los proyectos");

// Entradas ajenas
const { data: others } = await ana.c.from("time_entries").select("id").neq("user_id", ana.id).limit(1);
check(others.length === 0, "Ana no ve entradas de otros");
const { count } = await admin.c.from("time_entries").select("id", { count: "exact", head: true });
check(count > 1000, `Admin ve todas las entradas (${count})`);

// Perfiles
const { data: profs } = await ana.c.from("profiles").select("id");
check(profs.length === 1, "Ana solo ve su perfil");
await ana.c.from("profiles").update({ role: "admin" }).eq("id", ana.id);
const { data: me } = await ana.c.from("profiles").select("role").eq("id", ana.id).single();
check(me.role === "user", "Ana no puede hacerse admin");

// Proyecto no asignado
const now = Date.now();
const r1 = await ana.c.from("time_entries").insert({
  user_id: ana.id, title: "x", project_id: mant.id,
  started_at: new Date(now - 7200e3).toISOString(), ended_at: new Date(now - 3600e3).toISOString(),
});
check(!!r1.error, `No puede registrar en proyecto no asignado (${r1.error?.message})`);

// Registrar a nombre de otro
const r2 = await ana.c.from("time_entries").insert({
  user_id: admin.id, title: "x", project_id: web.id,
  started_at: new Date(now - 7200e3).toISOString(), ended_at: new Date(now - 3600e3).toISOString(),
});
check(!!r2.error, "No puede registrar horas de otra persona");

// Subtareas sin duplicados
const { data: t1 } = await ana.c.rpc("get_or_create_task", { p_project: web.id, p_name: "diseño ui" });
const { data: t2 } = await ana.c.rpc("get_or_create_task", { p_project: web.id, p_name: "  Diseño   UI " });
check(t1 && t1 === t2, "«diseño ui» y «  Diseño   UI » son la misma subtarea");
const r3 = await ana.c.rpc("get_or_create_task", { p_project: mant.id, p_name: "Hack" });
check(!!r3.error, "No puede crear subtareas en proyectos ajenos");

// Cronómetro: uno solo, y no se puede cerrar incompleto
const { data: run, error: runErr } = await ana.c.from("time_entries")
  .insert({ user_id: ana.id, started_at: new Date(now - 60e3).toISOString(), source: "timer" })
  .select().single();
check(!runErr, "Arranca cronómetro sin datos");
const r4 = await ana.c.from("time_entries").insert({ user_id: ana.id, started_at: new Date().toISOString() });
check(!!r4.error, "No permite dos cronómetros a la vez");
const r5 = await ana.c.from("time_entries").update({ ended_at: new Date().toISOString() }).eq("id", run.id);
check(!!r5.error, "No se puede parar sin título ni proyecto");
const r6 = await ana.c.from("time_entries")
  .update({ title: "Prueba", project_id: web.id, ended_at: new Date().toISOString() }).eq("id", run.id);
check(!r6.error, "Se para con título y proyecto");

// Bloqueo de periodos
const lockDate = new Date(now - 30 * 864e5).toISOString().slice(0, 10);
await admin.c.from("app_settings").update({ lock_before: lockDate }).eq("id", 1);
const { data: old } = await ana.c.from("time_entries").select("id")
  .lt("started_at", new Date(now - 40 * 864e5).toISOString()).limit(1).single();
const r7 = await ana.c.from("time_entries").update({ title: "cambio" }).eq("id", old.id);
check(!!r7.error, `Ana no puede editar una entrada bloqueada (${r7.error?.message})`);
const r8 = await ana.c.from("time_entries").delete().eq("id", old.id);
check(!!r8.error, "Ana no puede borrar una entrada bloqueada");
const r9 = await ana.c.from("time_entries").update({ started_at: new Date(now - 45 * 864e5).toISOString(), ended_at: new Date(now - 45 * 864e5 + 3600e3).toISOString() }).eq("id", run.id);
check(!!r9.error, "Ana no puede mover una entrada a un periodo cerrado");
const { data: oldRow } = await admin.c.from("time_entries").select("title").eq("id", old.id).single();
const r10 = await admin.c.from("time_entries").update({ title: oldRow.title }).eq("id", old.id);
check(!r10.error, "Admin sí puede editar entradas bloqueadas");
await admin.c.from("app_settings").update({ lock_before: null }).eq("id", 1);

// Auditoría
const { data: audit } = await admin.c.from("time_entry_audit").select("action").eq("entry_id", run.id);
check(audit.length >= 2, `Auditoría registrada (${audit.map((a) => a.action).join(", ")})`);
const { data: auditAna } = await ana.c.from("time_entry_audit").select("id").limit(1);
check(auditAna.length === 0, "Ana no ve la auditoría");

// Limpieza
await ana.c.from("time_entries").delete().eq("id", run.id);

console.log(failed ? `\n${failed} comprobaciones fallidas` : "\nTodo correcto");
process.exit(failed ? 1 : 0);
