// Datos ficticios para la demo: una empresa de ~42 personas con actividades distintas.
// Uso: npm run seed                 (necesita SUPABASE_SERVICE_ROLE_KEY en .env.local)
//      npm run seed -- --olvidado   (además deja a Ana con un cronómetro olvidado desde ayer)
// Es re-ejecutable: borra y regenera todo lo de los usuarios @lapso.demo.
import { createClient } from "@supabase/supabase-js";
import ws from "ws"; // Node < 22 no trae WebSocket nativo

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});
const PASSWORD = "LapsoDemo2026!";
const DOMAIN = "lapso.demo";
const DAYS = 100;
const FORGOTTEN = process.argv.includes("--olvidado");

// Festivos nacionales (no se registran horas)
const HOLIDAYS = new Set(["2026-08-15", "2026-10-12", "2026-11-01", "2026-12-08", "2026-12-25", "2027-01-01", "2027-01-06"]);

// PRNG determinista para que la demo sea estable entre ejecuciones
let seed = 20261005;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const shuffle = (arr) => arr.map((v) => [rand(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

// --- Empresa ------------------------------------------------------------------------

const departments = {
  "Diseño": 7,
  "Técnico": 9,
  "Producción": 8,
  "Comercial": 6,
  "Administración": 5,
  "Mantenimiento": 6,
};

const FIRST = ["Lucía", "Hugo", "Martina", "Daniel", "Sara", "Pablo", "Carmen", "Javier", "Paula", "Álvaro", "Elena", "Adrián",
  "Laura", "David", "Marta", "Sergio", "Irene", "Raúl", "Nerea", "Iván", "Cristina", "Alberto", "Noelia", "Rubén", "Silvia",
  "Óscar", "Beatriz", "Jorge", "Alba", "Miguel", "Rocío", "Andrés", "Natalia", "Víctor", "Eva", "Fernando", "Clara", "Gonzalo",
  "Patricia", "Diego", "Inés", "Marcos"];
const LAST = ["García", "Martínez", "López", "Sánchez", "Pérez", "Gómez", "Martín", "Jiménez", "Ruiz", "Hernández", "Díaz",
  "Moreno", "Muñoz", "Álvarez", "Romero", "Navarro", "Torres", "Domínguez", "Vázquez", "Ramos", "Gil", "Serrano", "Blanco",
  "Molina", "Morales", "Ortega", "Delgado", "Castro", "Ortiz", "Rubio", "Marín", "Sanz", "Iglesias", "Medina", "Garrido",
  "Cortés", "Castillo", "Santos", "Lozano", "Guerrero", "Cano", "Prieto"];

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

// Cuentas fijas para entrar en la demo + plantilla generada
const people = [
  { key: "admin", email: `admin@${DOMAIN}`, name: "Laura Producción", dept: "Producción", role: "admin" },
  { key: "ana", email: `ana@${DOMAIN}`, name: "Ana Martín", dept: "Diseño" },
];
{
  const used = new Set(people.map((p) => p.email));
  const firsts = shuffle(FIRST);
  let i = 0;
  for (const [dept, count] of Object.entries(departments)) {
    const already = people.filter((p) => p.dept === dept && p.role !== "admin").length;
    for (let n = already; n < count; n++) {
      const first = firsts[i % firsts.length];
      const last = LAST[(i * 7 + 3) % LAST.length];
      let email = `${slug(first)}.${slug(last)}@${DOMAIN}`;
      if (used.has(email)) email = `${slug(first)}.${slug(last)}${i}@${DOMAIN}`;
      used.add(email);
      people.push({
        key: email.split("@")[0],
        email,
        name: `${first} ${last}`,
        dept,
        // Algo de variedad: jornadas reducidas
        hours: rand() < 0.12 ? 6 : 8,
      });
      i++;
    }
  }
}

// Paleta categórica validada (mismo orden que la app)
const C = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

const projects = [
  { name: "Reforma oficinas Nexo", client: "Nexo Seguros", color: C[0], depts: ["Técnico", "Producción", "Diseño"],
    tasks: ["Planos y mediciones", "Dirección de obra", "Compras", "Reuniones con cliente"] },
  { name: "Campaña primavera", client: "Bodegas Sierra", color: C[1], depts: ["Diseño", "Comercial"],
    tasks: ["Concepto creativo", "Piezas gráficas", "Revisión cliente", "Plan de medios"] },
  { name: "Web corporativa", client: "Grupo Alba", color: C[2], depts: ["Diseño", "Técnico"],
    tasks: ["Diseño UI", "Desarrollo", "Contenidos", "Pruebas"] },
  { name: "Feria Expotec", client: "Expotec", color: C[3], depts: ["Producción", "Comercial", "Diseño"],
    tasks: ["Diseño de stand", "Montaje", "Logística", "Atención en feria"] },
  { name: "Mantenimiento instalaciones", client: "Varios clientes", color: C[4], depts: ["Mantenimiento", "Técnico"],
    tasks: ["Preventivo", "Correctivo", "Desplazamientos", "Partes e informes"] },
  { name: "Auditoría de procesos", client: "Clínica Vega", color: C[5], depts: ["Administración", "Producción"],
    tasks: ["Entrevistas", "Análisis", "Informe final"] },
  { name: "Licitación servicios municipales", client: "Sector público", color: C[6], depts: ["Comercial", "Administración", "Técnico"],
    tasks: ["Memoria técnica", "Documentación administrativa", "Presupuesto"] },
  { name: "Interno", client: null, color: C[7], depts: Object.keys(departments),
    tasks: ["Reunión general", "Formación", "Organización", "Facturación", "Nóminas y RR. HH.", "Planificación"] },
];

// Subtareas internas según el departamento
const INTERNAL_TASKS = {
  "Administración": ["Facturación", "Nóminas y RR. HH.", "Organización"],
  "Producción": ["Planificación", "Organización"],
};
const internalTasks = (dept) => INTERNAL_TASKS[dept] ?? ["Formación", "Organización"];

const titles = {
  "Planos y mediciones": ["Mediciones planta 2", "Ajuste de planos", "Revisión de cotas"],
  "Dirección de obra": ["Visita de obra", "Coordinación de gremios", "Acta de visita"],
  Compras: ["Pedido de materiales", "Comparativa de proveedores"],
  "Reuniones con cliente": ["Seguimiento semanal con cliente", "Presentación de avances"],
  "Concepto creativo": ["Moodboard", "Propuesta de concepto", "Naming de campaña"],
  "Piezas gráficas": ["Banners redes sociales", "Cartelería punto de venta", "Adaptaciones de formatos"],
  "Revisión cliente": ["Cambios tras feedback", "Segunda ronda de revisiones"],
  "Plan de medios": ["Calendario de publicaciones", "Presupuesto de medios"],
  "Diseño UI": ["Wireframes", "Diseño de la home", "Versión móvil"],
  Desarrollo: ["Maquetación", "Formulario de contacto", "Integración del CMS"],
  Contenidos: ["Textos de servicios", "Carga de fichas"],
  Pruebas: ["Pruebas en navegadores", "Revisión de incidencias"],
  "Diseño de stand": ["Render del stand", "Ajustes de diseño"],
  Montaje: ["Montaje del stand", "Desmontaje"],
  Logística: ["Transporte de material", "Coordinación con proveedores"],
  "Atención en feria": ["Atención a visitantes", "Reuniones comerciales en feria"],
  Preventivo: ["Revisión de climatización", "Revisión eléctrica", "Revisión de extintores"],
  Correctivo: ["Avería en cuadro eléctrico", "Fuga de agua", "Sustitución de luminarias"],
  Desplazamientos: ["Desplazamiento a cliente"],
  "Partes e informes": ["Partes de trabajo", "Informe mensual"],
  Entrevistas: ["Entrevistas con responsables"],
  "Análisis": ["Mapa de procesos", "Análisis de datos"],
  "Informe final": ["Redacción del informe", "Presentación de resultados"],
  "Memoria técnica": ["Redacción de la memoria técnica"],
  "Documentación administrativa": ["Preparar documentación", "Revisión de pliegos"],
  Presupuesto: ["Cálculo del presupuesto"],
  "Facturación": ["Emisión de facturas", "Conciliación bancaria"],
  "Nóminas y RR. HH.": ["Nóminas del mes", "Altas y bajas"],
  "Planificación": ["Planificación semanal", "Reunión de coordinación"],
  "Reunión general": ["Reunión general del equipo"],
  "Formación": ["Formación en prevención de riesgos", "Curso interno"],
  "Organización": ["Correo y organización", "Gestión de agenda"],
};

// --- Utilidades -----------------------------------------------------------------------

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function allPages(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = await must(build().range(from, from + 999), "lectura");
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// --- Proceso --------------------------------------------------------------------------

async function main() {
  // Usuarios demo existentes
  const authUsers = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    authUsers.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const demoIds = authUsers.filter((u) => u.email?.endsWith(`@${DOMAIN}`)).map((u) => u.id);

  // 1. Limpieza de lo demo
  if (demoIds.length) {
    for (let i = 0; i < demoIds.length; i += 50) {
      const ids = demoIds.slice(i, i + 50);
      await must(db.from("time_entries").delete().in("user_id", ids), "limpiar entradas");
      await must(db.from("project_members").delete().in("user_id", ids), "limpiar asignaciones");
    }
  }
  // Usuarios demo que ya no están en la plantilla
  const wanted = new Set(people.map((p) => p.email));
  for (const u of authUsers.filter((u) => u.email?.endsWith(`@${DOMAIN}`) && !wanted.has(u.email))) {
    await db.auth.admin.deleteUser(u.id);
  }
  // Proyectos y departamentos que no son de la demo (si no tienen horas de nadie)
  const projectNames = new Set(projects.map((p) => p.name));
  for (const p of await must(db.from("projects").select("id, name"), "proyectos")) {
    if (projectNames.has(p.name)) continue;
    const { error } = await db.from("projects").delete().eq("id", p.id);
    if (error) await db.from("projects").update({ archived: true }).eq("id", p.id);
  }
  for (const d of await must(db.from("departments").select("id, name"), "departamentos")) {
    if (!(d.name in departments)) await db.from("departments").delete().eq("id", d.id);
  }
  await db.from("app_settings").update({ lock_before: null }).eq("id", 1);

  // 2. Departamentos
  const deptRows = await must(
    db.from("departments").upsert(Object.keys(departments).map((name) => ({ name })), { onConflict: "name" }).select(),
    "departamentos",
  );
  const deptId = Object.fromEntries(deptRows.map((d) => [d.name, d.id]));

  // 3. Usuarios
  const byEmail = new Map(authUsers.map((u) => [u.email, u]));
  const userId = {};
  for (const p of people) {
    let user = byEmail.get(p.email);
    if (!user) {
      const { data, error } = await db.auth.admin.createUser({
        email: p.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: p.name },
      });
      if (error) throw new Error(`usuario ${p.email}: ${error.message}`);
      user = data.user;
    } else {
      await db.auth.admin.updateUserById(user.id, { password: PASSWORD, ban_duration: "none" });
    }
    await must(
      db.from("profiles")
        .update({ full_name: p.name, role: p.role ?? "user", department_id: deptId[p.dept], active: true })
        .eq("id", user.id),
      "perfil",
    );
    userId[p.key] = user.id;
  }
  process.stdout.write(`  ${people.length} usuarios listos\n`);

  // 4. Proyectos, subtareas y asignaciones
  const projectId = {};
  const taskIds = {};
  for (const pr of projects) {
    const [row] = await must(
      db.from("projects")
        .upsert({ name: pr.name, client: pr.client, color: pr.color, archived: false }, { onConflict: "name" })
        .select(),
      "proyecto",
    );
    projectId[pr.name] = row.id;
    await db.from("tasks").delete().eq("project_id", row.id); // subtareas limpias
    const trows = await must(
      db.from("tasks").insert(pr.tasks.map((name) => ({ project_id: row.id, name }))).select(),
      "subtareas",
    );
    taskIds[pr.name] = Object.fromEntries(trows.map((t) => [t.name, t.id]));
  }

  // Cada persona: Interno + 1–3 proyectos de su departamento (Ana fija, para la demo)
  const assigned = {};
  for (const p of people) {
    if (p.role === "admin") continue;
    const eligible = projects.filter((pr) => pr.name !== "Interno" && pr.depts.includes(p.dept)).map((pr) => pr.name);
    const n = p.key === "ana" ? eligible.length : Math.min(eligible.length, 1 + Math.floor(rand() * 3));
    assigned[p.key] = [...shuffle(eligible).slice(0, Math.max(1, n)), "Interno"];
  }
  const memberRows = Object.entries(assigned).flatMap(([key, names]) =>
    names.map((n) => ({ project_id: projectId[n], user_id: userId[key] })),
  );
  await must(db.from("project_members").upsert(memberRows, { onConflict: "project_id,user_id" }), "asignaciones");

  // 5. Entradas de tiempo
  const entries = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = Date.now();

  // Reunión general cada 14 días desde el ancla de ajustes (si existe)
  const { data: settings } = await db.from("app_settings").select("cycle_anchor, cycle_days").eq("id", 1).single();
  const anchor = settings?.cycle_anchor ? new Date(`${settings.cycle_anchor}T00:00:00`) : null;
  const cycle = settings?.cycle_days ?? 14;

  for (const p of people) {
    if (p.role === "admin") continue;
    const mine = assigned[p.key].filter((n) => n !== "Interno");
    const dailyMins = (p.hours ?? 8) * 60;

    for (let d = DAYS; d >= 0; d--) {
      const day = new Date(today);
      day.setDate(day.getDate() - d);
      const dow = day.getDay();
      if (dow === 0 || dow === 6 || HOLIDAYS.has(ymd(day))) continue;
      if (rand() < 0.05) continue; // vacaciones, bajas, días libres
      if (d === 0 && rand() < 0.4) continue;

      const blocks = [];
      // Math.round absorbe el cambio de hora; -0 % n === 0 también cuenta hacia atrás
      const meetingDay = anchor && Math.round((day - anchor) / 864e5) % cycle === 0;
      if (meetingDay) blocks.push({ project: "Interno", task: "Reunión general", mins: 60 });

      let planned = blocks.reduce((s, b) => s + b.mins, 0);
      while (planned < dailyMins - 20) {
        const internal = p.dept === "Administración" ? rand() < 0.35 : rand() < 0.07;
        const prName = internal ? "Interno" : pick(mine);
        const pr = projects.find((x) => x.name === prName);
        const task = internal ? pick(internalTasks(p.dept)) : pick(pr.tasks);
        const mins = Math.min(dailyMins - planned, [30, 45, 60, 90, 120, 150, 180, 240][Math.floor(rand() * 8)]);
        if (mins < 15) break;
        blocks.push({ project: prName, task, mins });
        planned += mins;
      }

      let t = 8 * 60 + Math.floor(rand() * 75); // empieza entre 8:00 y 9:15
      let lunch = false;
      for (const b of blocks) {
        if (!lunch && t >= 13 * 60 + 30) {
          t += 45 + Math.floor(rand() * 30); // comida
          lunch = true;
        }
        const start = new Date(day.getTime() + t * 60000);
        const end = new Date(start.getTime() + b.mins * 60000);
        if (end.getTime() > now) break;
        entries.push({
          user_id: userId[p.key],
          title: pick(titles[b.task] ?? [b.task]),
          project_id: projectId[b.project],
          task_id: taskIds[b.project][b.task],
          started_at: start.toISOString(),
          ended_at: end.toISOString(),
          source: rand() < 0.65 ? "timer" : "manual",
        });
        t += b.mins + (rand() < 0.3 ? 10 + Math.floor(rand() * 15) : 0);
      }
    }
  }

  for (let i = 0; i < entries.length; i += 1000) {
    await must(db.from("time_entries").insert(entries.slice(i, i + 1000)), "entradas");
    process.stdout.write(`\r  entradas: ${Math.min(i + 1000, entries.length)}/${entries.length}`);
  }
  process.stdout.write("\n");

  // 6. Opcional: cronómetro olvidado de Ana desde ayer por la tarde
  if (FORGOTTEN) {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    while (y.getDay() === 0 || y.getDay() === 6) y.setDate(y.getDate() - 1);
    y.setHours(15, 30, 0, 0);
    const pr = assigned.ana.find((n) => n !== "Interno");
    await must(
      db.from("time_entries").insert({
        user_id: userId.ana,
        title: "Ajustes de diseño",
        project_id: projectId[pr],
        task_id: Object.values(taskIds[pr])[0],
        started_at: y.toISOString(),
        source: "timer",
      }),
      "cronómetro olvidado",
    );
    console.log(`  Ana tiene un cronómetro en marcha desde ${y.toLocaleString("es-ES")}`);
  }

  console.log(
    `✔ ${people.length} personas, ${Object.keys(departments).length} departamentos, ${projects.length} proyectos, ${entries.length} entradas.`,
  );
  console.log(`  Contraseña de todos los usuarios demo: ${PASSWORD}`);
  console.log(`  Producción: admin@${DOMAIN} · Usuaria: ana@${DOMAIN}`);
}

main().catch((e) => {
  console.error("\n✖", e.message);
  process.exit(1);
});
