// Comprueba en la base de datos los efectos de la prueba manual E2E.
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const opts = { auth: { persistSession: false }, realtime: { transport: ws } };
const anon = () => createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, opts);

const login = async (email, password) => !(await anon().auth.signInWithPassword({ email, password })).error;
const check = (ok, msg) => console.log(`${ok ? "✔" : "✖"} ${msg}`);

check(await login("ana@lapso.demo", "PruebaE2E-2026"), "Ana entra con su contraseña nueva");
check(!(await login("ana@lapso.demo", "LapsoDemo2026!")), "La contraseña antigua de Ana ya no sirve");

const { data: e2e } = await db.from("profiles").select("id, full_name, active, department_id, departments(name)").eq("email", "e2e@lapso.demo").single();
check(e2e && !e2e.active, `«${e2e?.full_name}» está desactivada en su perfil`);
check(e2e?.departments?.name === "Técnico", `Su departamento es Técnico (${e2e?.departments?.name ?? "ninguno"})`);
const { data: m } = await db.from("project_members").select("projects(name)").eq("user_id", e2e.id);
check(m?.some((x) => x.projects?.name === "Prueba E2E"), `Asignada a «Prueba E2E» (${m?.map((x) => x.projects?.name).join(", ")})`);
// La contraseña temporal la generó la app; probamos con una cualquiera: lo importante es el bloqueo de auth
const { data: authUser } = await db.auth.admin.getUserById(e2e.id);
check(!!authUser.user?.banned_until, `Bloqueada en el inicio de sesión (hasta ${authUser.user?.banned_until?.slice(0, 10)})`);

const { data: proj } = await db.from("projects").select("id").eq("name", "Prueba E2E").single();
const { data: tasks } = await db.from("tasks").select("name").eq("project_id", proj.id);
check(tasks?.some((t) => t.name === "Subtarea nueva E2E"), "La subtarea creada por Ana existe en el proyecto");
const { data: s } = await db.from("app_settings").select("lock_before").eq("id", 1).single();
check(s.lock_before === "2026-10-05", `Periodo cerrado hasta ${s.lock_before}`);
