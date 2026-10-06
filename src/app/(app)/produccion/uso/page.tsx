import { redirect } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import { requireAdmin } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll, loadLookup } from "@/lib/reports";
import { FREE_DB_BYTES, canSeeUsage } from "@/lib/usage";
import { formatDuration } from "@/lib/utils";

export const metadata = { title: "Uso" };

const DAY = 864e5;

type Entry = { user_id: string; started_at: string; ended_at: string | null; source: string; created_at: string; updated_at: string };
type DbStats = { db_bytes: number; tables: { name: string; bytes: number; rows: number }[] };

const mb = (b: number) => `${(b / 1024 / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** Instantes de referencia de la petición (fuera del render para no romper la pureza). */
function windowStarts() {
  const now = Date.now();
  return { now, d7: now - 7 * DAY, d30: now - 30 * DAY };
}

export default async function UsoPage() {
  const { supabase, profile } = await requireAdmin();
  if (!canSeeUsage(profile)) redirect("/produccion");

  const { now, d7, d30 } = windowStarts();
  const lookup = await loadLookup(supabase);
  const tz = lookup.settings.tz;

  const [entries30, totalRes, dbRes, authUsers] = await Promise.all([
    fetchAll<Entry>((from, to) =>
      supabase
        .from("time_entries")
        .select("user_id, started_at, ended_at, source, created_at, updated_at")
        .gte("started_at", new Date(d30).toISOString())
        .order("started_at")
        .range(from, to),
    ),
    supabase.from("time_entries").select("id", { count: "exact", head: true }),
    supabase.rpc("usage_db_stats"),
    (async () => {
      // Último acceso de cada persona (solo lo sabe auth: requiere la clave de servidor)
      const out = new Map<string, string | null>();
      try {
        const admin = createAdminClient();
        for (let page = 1; page < 50; page++) {
          const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
          if (error) break;
          for (const u of data.users) out.set(u.id, u.last_sign_in_at ?? null);
          if (data.users.length < 1000) break;
        }
      } catch {}
      return out;
    })(),
  ]);

  const people = lookup.people.filter((p) => p.active && p.role === "user");
  const totalEntries = totalRes.count ?? 0;
  const db = dbRes.error ? null : (dbRes.data as DbStats);

  // Adopción
  const secsOf = (e: Entry) => (e.ended_at ? (Date.parse(e.ended_at) - Date.parse(e.started_at)) / 1000 : 0);
  const active7 = new Set(entries30.filter((e) => Date.parse(e.started_at) >= d7).map((e) => e.user_id));
  const active30 = new Set(entries30.map((e) => e.user_id));
  const neverIn = people.filter((p) => !authUsers.get(p.id));
  const finished = entries30.filter((e) => e.ended_at);
  const timerPct = pct(finished.filter((e) => e.source === "timer").length, finished.length);
  const editedPct = pct(finished.filter((e) => Date.parse(e.updated_at) - Date.parse(e.created_at) > 60_000).length, finished.length);
  const forgotten = finished.filter((e) => secsOf(e) > 10 * 3600).length;
  const running = entries30.filter((e) => !e.ended_at).length;

  // Actividad diaria (30 días): horas y personas
  const days: { key: string; label: string; hours: number; people: number; weekend: boolean }[] = [];
  for (let t = d30 + DAY; t <= now; t += DAY) {
    const d = new TZDate(t, tz);
    days.push({ key: format(d, "yyyy-MM-dd"), label: format(d, "d MMM", { locale: es }), hours: 0, people: 0, weekend: [0, 6].includes(d.getDay()) });
  }
  const byDay = new Map(days.map((d) => [d.key, { d, users: new Set<string>() }]));
  for (const e of finished) {
    const slot = byDay.get(format(new TZDate(e.started_at, tz), "yyyy-MM-dd"));
    if (!slot) continue;
    slot.d.hours += secsOf(e) / 3600;
    slot.users.add(e.user_id);
  }
  for (const { d, users } of byDay.values()) d.people = users.size;
  const maxPeople = Math.max(1, people.length, ...days.map((d) => d.people));

  // Por persona: último acceso y horas en 7 días
  const hours7 = new Map<string, number>();
  for (const e of finished) if (Date.parse(e.started_at) >= d7) hours7.set(e.user_id, (hours7.get(e.user_id) ?? 0) + secsOf(e));
  const rows = people
    .map((p) => ({ ...p, last: authUsers.get(p.id) ?? null, secs7: hours7.get(p.id) ?? 0 }))
    .sort((a, b) => (a.secs7 - b.secs7) || (Date.parse(a.last ?? "0") - Date.parse(b.last ?? "0")));

  // Recursos y proyección
  const entriesBytes = db?.tables.filter((t) => ["time_entries", "time_entry_audit"].includes(t.name)).reduce((s, t) => s + t.bytes, 0) ?? 0;
  const bytesPerEntry = totalEntries ? entriesBytes / totalEntries : 0;
  const entriesPerMonth = finished.length; // últimos 30 días
  const growthPerMonth = bytesPerEntry * entriesPerMonth;
  const monthsLeft = db && growthPerMonth > 0 ? (FREE_DB_BYTES - db.db_bytes) / growthPerMonth : null;

  const cards = [
    { label: "Activas últimos 7 días", value: `${active7.size}/${people.length}`, hint: `${pct(active7.size, people.length)} % de la plantilla` },
    { label: "Activas últimos 30 días", value: `${active30.size}/${people.length}`, hint: `${pct(active30.size, people.length)} %` },
    { label: "Nunca han entrado", value: String(neverIn.length), hint: neverIn.length ? "ver tabla de personas" : "todo el equipo ha accedido" },
    { label: "Entradas en 30 días", value: entriesPerMonth.toLocaleString("es-ES"), hint: `${timerPct} % con cronómetro` },
    { label: "Editadas después", value: `${editedPct} %`, hint: "en los últimos 30 días" },
    { label: "Posibles olvidos", value: String(forgotten), hint: `entradas > 10 h · ${running} cronómetro${running === 1 ? "" : "s"} en marcha` },
  ];

  return (
    <div className="space-y-10">
      <div>
        <p className="eyebrow">Panel interno · últimos 30 días</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Uso de la aplicación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Adopción del equipo y consumo de recursos, para decidir cuándo y cómo escalar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-border py-6 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label}>
            <p className="eyebrow">{c.label}</p>
            <p className="mt-1.5 text-3xl font-semibold tracking-tight">{c.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Personas que registran cada día</h2>
          <span className="text-sm text-muted-foreground">de {people.length} en plantilla</span>
        </div>
        <div className="flex h-40 items-end gap-1 border-b border-input">
          {days.map((d) => (
            <div key={d.key} className="group relative flex flex-1 flex-col items-center justify-end" title={`${d.label}: ${d.people} personas · ${Math.round(d.hours)} h`}>
              <div
                className={`w-full max-w-5 rounded-t-[3px] ${d.weekend ? "bg-muted" : "bg-primary"}`}
                style={{ height: `${Math.max(d.people ? 3 : 0, (d.people / maxPeople) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>{days[0]?.label}</span>
          <span>{days[Math.floor(days.length / 2)]?.label}</span>
          <span>{days.at(-1)?.label}</span>
        </div>
      </section>

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section>
          <h2 className="mb-1 text-lg font-semibold tracking-tight">Personas</h2>
          <p className="mb-3 text-sm text-muted-foreground">Primero quien menos lo usa.</p>
          <div className="max-h-[28rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-left">
                  <th className="eyebrow py-2 pr-3 font-normal">Persona</th>
                  <th className="eyebrow py-2 pr-3 font-normal">Último acceso</th>
                  <th className="eyebrow py-2 text-right font-normal">Horas 7 días</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 pr-3">
                      <p className="font-medium">{r.full_name || r.email}</p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {r.last ? (
                        formatDistanceToNowStrict(new Date(r.last), { locale: es, addSuffix: true })
                      ) : (
                        <span className="font-medium text-destructive">Nunca</span>
                      )}
                    </td>
                    <td className={`py-2 text-right font-mono text-[13px] ${r.secs7 ? "" : "text-destructive"}`}>
                      {r.secs7 ? formatDuration(r.secs7) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold tracking-tight">Recursos y coste</h2>
          {db ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">Base de datos frente al límite del plan gratuito de Supabase.</p>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-semibold tracking-tight">{mb(db.db_bytes)}</span>
                <span className="font-mono text-xs text-muted-foreground">de {mb(FREE_DB_BYTES)} · {pct(db.db_bytes, FREE_DB_BYTES)} %</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct(db.db_bytes, FREE_DB_BYTES))}%` }} />
              </div>
              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between border-t border-border pt-2">
                  <dt className="text-muted-foreground">Espacio por entrada (con historial)</dt>
                  <dd className="font-mono">{bytesPerEntry ? `${(bytesPerEntry / 1024).toLocaleString("es-ES", { maximumFractionDigits: 2 })} KB` : "—"}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <dt className="text-muted-foreground">Crecimiento al ritmo actual</dt>
                  <dd className="font-mono">{mb(growthPerMonth)}/mes</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <dt className="text-muted-foreground">Límite gratuito alcanzado en</dt>
                  <dd className="font-mono">
                    {monthsLeft === null ? "—" : monthsLeft > 120 ? "más de 10 años" : `≈ ${Math.round(monthsLeft)} meses`}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <dt className="text-muted-foreground">Entradas totales</dt>
                  <dd className="font-mono">{totalEntries.toLocaleString("es-ES")}</dd>
                </div>
              </dl>
              <p className="mt-5 rounded-lg bg-primary-soft px-3 py-2 text-sm">
                {monthsLeft === null || monthsLeft > 24
                  ? "El plan gratuito de base de datos es suficiente con este uso. Revisar cada trimestre."
                  : monthsLeft > 6
                    ? "Conviene planificar el paso a Supabase Pro (25 $/mes) en los próximos meses."
                    : "Pasar a Supabase Pro (25 $/mes) pronto: el límite gratuito está cerca."}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                El consumo de la web (créditos de Netlify) se consulta en el panel de Netlify → Usage.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Para ver el tamaño de la base de datos, ejecuta la migración <code className="font-mono">0003_usage_stats.sql</code> en Supabase.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
