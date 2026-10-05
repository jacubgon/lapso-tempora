// Datos ficticios para la demo: departamentos, usuarios, proyectos, subtareas y ~3 meses de horas.
// Uso: npm run seed   (necesita SUPABASE_SERVICE_ROLE_KEY en .env.local)
// Es re-ejecutable: reutiliza usuarios/proyectos existentes y regenera las entradas demo.
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
const DAYS = 90;

const departments = ["Diseño", "Desarrollo", "Producción"];

const people = [
  { email: "admin@lapso.demo", name: "Laura Producción", dept: "Producción", role: "admin" },
  { email: "ana@lapso.demo", name: "Ana Martín", dept: "Diseño" },
  { email: "pablo@lapso.demo", name: "Pablo Ruiz", dept: "Diseño" },
  { email: "marta@lapso.demo", name: "Marta Gil", dept: "Desarrollo" },
  { email: "diego@lapso.demo", name: "Diego Sanz", dept: "Desarrollo" },
  { email: "lucia@lapso.demo", name: "Lucía Ortega", dept: "Desarrollo" },
  { email: "sergio@lapso.demo", name: "Sergio Vidal", dept: "Producción" },
];

const projects = [
  { name: "Web corporativa", client: "Grupo Alba", color: "#2a78d6",
    tasks: ["Diseño UI", "Maquetación", "Contenidos", "Reuniones"],
    members: ["ana", "pablo", "marta", "sergio"] },
  { name: "App de reservas", client: "Hotel Mirador", color: "#eb6834",
    tasks: ["Backend", "Frontend", "QA", "Reuniones"],
    members: ["marta", "diego", "lucia", "ana"] },
  { name: "Campaña otoño", client: "Bodegas Sierra", color: "#1baf7a",
    tasks: ["Concepto", "Piezas gráficas", "Revisión cliente"],
    members: ["ana", "pablo", "sergio"] },
  { name: "Mantenimiento", client: "Varios", color: "#eda100",
    tasks: ["Incidencias", "Actualizaciones"],
    members: ["diego", "lucia", "marta"] },
  { name: "Interno", client: null, color: "#e87ba4",
    tasks: ["Reunión general", "Formación", "Gestión"],
    members: ["ana", "pablo", "marta", "diego", "lucia", "sergio"] },
];

const titles = {
  "Diseño UI": ["Wireframes home", "Sistema de componentes", "Ajustes de diseño móvil"],
  Maquetación: ["Maquetar landing", "Formulario de contacto", "Revisión responsive"],
  Contenidos: ["Textos sección servicios", "Carga de fichas"],
  Reuniones: ["Seguimiento con cliente", "Daily del proyecto"],
  Backend: ["API de disponibilidad", "Pasarela de pago", "Modelo de datos"],
  Frontend: ["Pantalla de reserva", "Calendario", "Login y registro"],
  QA: ["Pruebas de regresión", "Revisión de incidencias"],
  Concepto: ["Moodboard", "Propuesta creativa"],
  "Piezas gráficas": ["Banners redes", "Cartelería", "Adaptaciones formatos"],
  "Revisión cliente": ["Cambios tras feedback"],
  Incidencias: ["Error en formulario", "Caída de servidor", "Soporte usuario"],
  Actualizaciones: ["Actualizar dependencias", "Parche de seguridad"],
  "Reunión general": ["Reunión general del equipo"],
  Formación: ["Curso de accesibilidad", "Taller interno"],
  Gestión: ["Planificación semanal", "Partes y organización"],
};

// PRNG determinista para que la demo sea estable entre ejecuciones
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function main() {
  // Departamentos
  const deptRows = await must(
    db.from("departments").upsert(departments.map((name) => ({ name })), { onConflict: "name" }).select(),
    "departamentos",
  );
  const deptId = Object.fromEntries(deptRows.map((d) => [d.name, d.id]));

  // Usuarios
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const userId = {};
  for (const p of people) {
    let user = list.users.find((u) => u.email === p.email);
    if (!user) {
      const { data, error } = await db.auth.admin.createUser({
        email: p.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: p.name },
      });
      if (error) throw new Error(`usuario ${p.email}: ${error.message}`);
      user = data.user;
    }
    await must(
      db.from("profiles").update({
        full_name: p.name,
        role: p.role ?? "user",
        department_id: deptId[p.dept],
        active: true,
      }).eq("id", user.id),
      "perfil",
    );
    userId[p.email.split("@")[0]] = user.id;
  }

  // Proyectos, miembros y subtareas
  const taskIds = {}; // projectName -> { taskName: id }
  const projectId = {};
  for (const pr of projects) {
    const [row] = await must(
      db.from("projects").upsert(
        { name: pr.name, client: pr.client, color: pr.color, archived: false },
        { onConflict: "name" },
      ).select(),
      "proyecto",
    );
    projectId[pr.name] = row.id;
    await must(
      db.from("project_members").upsert(
        pr.members.map((m) => ({ project_id: row.id, user_id: userId[m] })),
        { onConflict: "project_id,user_id" },
      ),
      "miembros",
    );
    const trows = await must(
      db.from("tasks").upsert(
        pr.tasks.map((name) => ({ project_id: row.id, name, created_by: userId[pr.members[0]] })),
        { onConflict: "project_id,name" },
      ).select(),
      "subtareas",
    );
    taskIds[pr.name] = Object.fromEntries(trows.map((t) => [t.name, t.id]));
  }

  // Entradas: borramos las de los usuarios demo y regeneramos
  const demoIds = Object.values(userId);
  await must(db.from("time_entries").delete().in("user_id", demoIds), "limpiar entradas");

  const entries = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const p of people) {
    if (p.role === "admin") continue;
    const key = p.email.split("@")[0];
    const mine = projects.filter((pr) => pr.members.includes(key) && pr.name !== "Interno");

    for (let d = DAYS; d >= 0; d--) {
      const day = new Date(today);
      day.setDate(day.getDate() - d);
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue; // fin de semana
      if (rand() < 0.06) continue;         // algún día libre
      if (d === 0 && rand() < 0.5) continue;

      let cursor = 8 * 60 + 30 + Math.floor(rand() * 60); // 8:30–9:30
      const endOfDay = 17 * 60 + Math.floor(rand() * 90);

      // Reunión general cada 14 días (los lunes alternos)
      const weekIndex = Math.floor((today - day) / (7 * 864e5));
      const blocks = [];
      if (dow === 1 && weekIndex % 2 === 0) blocks.push({ project: "Interno", task: "Reunión general", mins: 60 });

      while (cursor < endOfDay) {
        const pr = rand() < 0.08 ? projects.find((x) => x.name === "Interno") : pick(mine);
        const task = pick(pr.tasks.filter((t) => t !== "Reunión general"));
        const mins = [30, 45, 60, 90, 120, 150, 180][Math.floor(rand() * 7)];
        blocks.push({ project: pr.name, task, mins });
        cursor += mins + (rand() < 0.3 ? 60 : 10); // pausa (comida o breve)
      }

      let t = 8 * 60 + 30 + Math.floor(rand() * 45);
      for (const b of blocks) {
        const start = new Date(day.getTime() + t * 60000);
        const end = new Date(start.getTime() + b.mins * 60000);
        if (end > new Date()) break;
        entries.push({
          user_id: userId[key],
          title: pick(titles[b.task] ?? [b.task]),
          project_id: projectId[b.project],
          task_id: taskIds[b.project][b.task],
          started_at: start.toISOString(),
          ended_at: end.toISOString(),
          source: rand() < 0.6 ? "timer" : "manual",
        });
        t += b.mins + (rand() < 0.25 ? 45 : 10);
        if (t > 19 * 60) break;
      }
    }
  }

  for (let i = 0; i < entries.length; i += 500) {
    await must(db.from("time_entries").insert(entries.slice(i, i + 500)), "entradas");
  }

  console.log(`✔ ${people.length} usuarios, ${projects.length} proyectos, ${entries.length} entradas.`);
  console.log(`  Contraseña de todos los usuarios demo: ${PASSWORD}`);
  console.log(`  Admin (producción): admin@lapso.demo · Usuario: ana@lapso.demo`);
}

main().catch((e) => {
  console.error("✖", e.message);
  process.exit(1);
});
