// Smoke test: inicia sesión como usuario demo y recorre las páginas de la app en marcha.
// Uso: node --env-file=.env.local scripts/smoke.mjs [baseUrl]
import { createServerClient } from "@supabase/ssr";
import ws from "ws";

const base = process.argv[2] ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function cookieFor(email) {
  const jar = new Map();
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
    realtime: { transport: ws },
  });
  const { error } = await sb.auth.signInWithPassword({ email, password: "LapsoDemo2026!" });
  if (error) throw new Error(error.message);
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

let failed = 0;
async function visit(cookie, path, expect = [], { binary = false } = {}) {
  const t = Date.now();
  const res = await fetch(base + path, { headers: { cookie }, redirect: "manual" });
  const ms = Date.now() - t;
  const body = binary ? "" : await res.text();
  const missing = expect.filter((s) => !body.includes(s));
  const errorPage = /Application error|Unhandled Runtime Error|__next_error__/.test(body);
  const ok = res.status === 200 && !missing.length && !errorPage;
  if (!ok) failed++;
  const extra = binary ? ` ${res.headers.get("content-type")} ${res.headers.get("content-disposition")}` : "";
  console.log(`${ok ? "✔" : "✖"} ${res.status} ${path} (${ms} ms)${extra}${missing.length ? ` falta: ${missing.join(", ")}` : ""}${errorPage ? " [página de error]" : ""}`);
  return { res, body };
}

const admin = await cookieFor("admin@lapso.demo");
await visit(admin, "/produccion", ["Informes", "Horas registradas", "Personas × proyectos"]);
await visit(admin, "/produccion?p=cycle", ["Ciclo ·"]);
await visit(admin, "/produccion?p=month&agrupar=user", ["Reparto por persona"]);
await visit(admin, "/produccion?p=year&agrupar=department", ["Reparto por departamento"]);
await visit(admin, "/produccion?p=all&agrupar=task", ["Todo el histórico"]);
await visit(admin, "/produccion?p=custom&desde=2026-09-01&hasta=2026-09-14&agrupar=client", ["Reparto por cliente"]);
await visit(admin, "/produccion/detalle?p=cycle", ["Detalle de entradas", "entradas"]);
await visit(admin, "/produccion/detalle?p=all&orden=desc&pagina=2", ["Página"]);
await visit(admin, "/produccion/gestion", ["Nuevo proyecto"]);
await visit(admin, "/produccion/gestion?tab=personas", ["Nueva persona"]);
await visit(admin, "/produccion/gestion?tab=departamentos", ["Diseño"]);
await visit(admin, "/produccion/gestion?tab=ajustes", ["Ciclo de reuniones"]);
await visit(admin, "/produccion/exportar?tipo=detalle&formato=csv&p=cycle", [], { binary: true });
await visit(admin, "/produccion/exportar?tipo=detalle&formato=xlsx&p=all", [], { binary: true });
await visit(admin, "/produccion/exportar?tipo=resumen&formato=xlsx&p=month", [], { binary: true });

await visit(admin, "/cuenta", ["Cambiar contraseña"]);
await visit("", "/login/recuperar", ["Enviar enlace"]);

const ana = await cookieFor("ana@lapso.demo");
await visit(ana, "/", ["Cronómetro"]);
await visit(ana, "/cuenta", ["Mi cuenta", "Cambiar contraseña"]);
const r = await fetch(base + "/produccion", { headers: { cookie: ana }, redirect: "manual" });
const blocked = r.status >= 300 && r.status < 400;
if (!blocked) failed++;
console.log(`${blocked ? "✔" : "✖"} Ana no entra en /produccion (${r.status} → ${r.headers.get("location")})`);
const ex = await fetch(base + "/produccion/exportar?tipo=detalle&formato=csv", { headers: { cookie: ana } });
if (ex.status !== 403) failed++;
console.log(`${ex.status === 403 ? "✔" : "✖"} Ana no puede exportar (${ex.status})`);

console.log(failed ? `\n${failed} fallos` : "\nTodo correcto");
process.exit(failed ? 1 : 0);
