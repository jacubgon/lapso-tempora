import "server-only";
import { TZDate } from "@date-fns/tz";
import { format, startOfMonth, startOfWeek } from "date-fns";
import type { createClient } from "@/lib/supabase/server";
import { resolvePeriod, type Period, type PeriodParams } from "@/lib/period";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Dimension = "project" | "user" | "department" | "task" | "client";

export const DIMENSIONS: { id: Dimension; label: string }[] = [
  { id: "project", label: "Proyecto" },
  { id: "user", label: "Persona" },
  { id: "department", label: "Departamento" },
  { id: "task", label: "Subtarea" },
  { id: "client", label: "Cliente" },
];

export type ReportSearchParams = PeriodParams & {
  dep?: string;
  usuario?: string;
  proyecto?: string;
  tarea?: string;
  agrupar?: string;
  orden?: string;
  pagina?: string;
};

export type Filters = {
  department: string | null;
  user: string | null;
  project: string | null;
  task: string | null;
  groupBy: Dimension;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (v?: string) => (v && UUID_RE.test(v) ? v : null);

export function parseFilters(sp: ReportSearchParams): Filters {
  const groupBy = DIMENSIONS.some((d) => d.id === sp.agrupar) ? (sp.agrupar as Dimension) : "project";
  return {
    department: uuidOrNull(sp.dep),
    user: uuidOrNull(sp.usuario),
    project: uuidOrNull(sp.proyecto),
    task: uuidOrNull(sp.tarea),
    groupBy,
  };
}

// --- Contexto: catálogos para filtros y nombres --------------------------------

export type Lookup = {
  departments: { id: string; name: string }[];
  people: { id: string; full_name: string; email: string; department_id: string | null; active: boolean; role: string }[];
  projects: { id: string; name: string; client: string | null; color: string; archived: boolean }[];
  tasks: { id: string; project_id: string; name: string }[];
  settings: { tz: string; cycleAnchor: string | null; cycleDays: number; lockBefore: string | null };
};

export async function loadLookup(supabase: Supabase): Promise<Lookup> {
  const [dep, ppl, prj, tsk, set] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, email, department_id, active, role").order("full_name"),
    supabase.from("projects").select("id, name, client, color, archived").order("name"),
    fetchAll((from, to) => supabase.from("tasks").select("id, project_id, name").order("name").range(from, to)),
    supabase.from("app_settings").select("timezone, cycle_anchor, cycle_days, lock_before").eq("id", 1).single(),
  ]);
  return {
    departments: dep.data ?? [],
    people: ppl.data ?? [],
    projects: prj.data ?? [],
    tasks: tsk,
    settings: {
      tz: set.data?.timezone ?? "Europe/Madrid",
      cycleAnchor: set.data?.cycle_anchor ?? null,
      cycleDays: set.data?.cycle_days ?? 14,
      lockBefore: set.data?.lock_before ?? null,
    },
  };
}

export function periodFor(sp: PeriodParams, lookup: Lookup): Period {
  return resolvePeriod(sp, lookup.settings);
}

// --- Consultas ---------------------------------------------------------------------

const PAGE = 1000; // límite de filas por petición en Supabase

/** Descarga todas las filas paginando (en paralelo tras la primera página). */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null; count?: number | null }>,
): Promise<T[]> {
  const first = await page(0, PAGE - 1);
  if (first.error) throw new Error(first.error.message);
  const rows = first.data ?? [];
  if (rows.length < PAGE) return rows;

  // Seguimos en bloques de 5 páginas en paralelo hasta agotar
  let offset = PAGE;
  while (true) {
    const batch = await Promise.all(
      Array.from({ length: 5 }, (_, i) => page(offset + i * PAGE, offset + (i + 1) * PAGE - 1)),
    );
    let done = false;
    for (const r of batch) {
      if (r.error) throw new Error(r.error.message);
      rows.push(...(r.data ?? []));
      if ((r.data?.length ?? 0) < PAGE) done = true;
    }
    if (done) return rows;
    offset += 5 * PAGE;
  }
}

/** Personas afectadas por los filtros de departamento/usuario (null = todas). */
function userScope(f: Filters, lookup: Lookup): string[] | null {
  if (f.user) return [f.user];
  if (f.department) return lookup.people.filter((p) => p.department_id === f.department).map((p) => p.id);
  return null;
}

type Filterable = {
  not(column: string, op: string, value: null): Filterable;
  gte(column: string, value: string): Filterable;
  lt(column: string, value: string): Filterable;
  eq(column: string, value: string): Filterable;
  in(column: string, values: string[]): Filterable;
};

/** Aplica periodo + filtros a una consulta de time_entries. */
export function applyFilters<Q>(q: Q, f: Filters, period: Period, lookup: Lookup): Q {
  let query = (q as unknown as Filterable).not("ended_at", "is", null);
  if (period.from) query = query.gte("started_at", period.from.toISOString());
  if (period.to) query = query.lt("started_at", period.to.toISOString());
  const users = userScope(f, lookup);
  if (users) query = query.in("user_id", users.length ? users : ["00000000-0000-0000-0000-000000000000"]);
  if (f.project) query = query.eq("project_id", f.project);
  if (f.task) query = query.eq("task_id", f.task);
  return query as unknown as Q;
}

export type RawEntry = {
  user_id: string;
  project_id: string;
  task_id: string | null;
  started_at: string;
  ended_at: string;
};

export async function fetchReportEntries(supabase: Supabase, f: Filters, period: Period, lookup: Lookup) {
  return fetchAll<RawEntry>((from, to) =>
    applyFilters(
      supabase.from("time_entries").select("user_id, project_id, task_id, started_at, ended_at"),
      f,
      period,
      lookup,
    )
      .order("started_at")
      .order("id")
      .range(from, to),
  );
}

// --- Agregación -------------------------------------------------------------------

// Paleta categórica validada (orden fijo, apto para daltonismo en pares adyacentes)
export const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
export const OTHER_COLOR = "#898781";

export type GroupRow = { key: string; label: string; sub?: string; color: string; seconds: number; entries: number; people: number };
export type SeriesPoint = { bucket: string; label: string; [groupKey: string]: number | string };
export type Bucket = "day" | "week" | "month";

export type Report = {
  totalSeconds: number;
  entries: number;
  people: number;
  activeDays: number;
  /** Pares (persona, día) con horas: para la media diaria por persona */
  personDays: number;
  groups: GroupRow[];
  series: SeriesPoint[];
  seriesKeys: { key: string; label: string; color: string }[];
  bucket: Bucket;
  matrix: {
    rows: { id: string; label: string }[];
    cols: { id: string; label: string; color: string }[];
    cells: Record<string, Record<string, number>>;
  };
};

export function makeLabeler(lookup: Lookup) {
  const person = new Map(lookup.people.map((p) => [p.id, p]));
  const project = new Map(lookup.projects.map((p) => [p.id, p]));
  const task = new Map(lookup.tasks.map((t) => [t.id, t]));
  const dept = new Map(lookup.departments.map((d) => [d.id, d]));
  return { person, project, task, dept };
}

function groupKeyOf(e: RawEntry, dim: Dimension, L: ReturnType<typeof makeLabeler>) {
  switch (dim) {
    case "project":
      return e.project_id;
    case "user":
      return e.user_id;
    case "department":
      return L.person.get(e.user_id)?.department_id ?? "none";
    case "task":
      return e.task_id ?? `none:${e.project_id}`;
    case "client":
      return L.project.get(e.project_id)?.client ?? "none";
  }
}

function describe(key: string, dim: Dimension, L: ReturnType<typeof makeLabeler>, i: number) {
  const fallback = PALETTE[i % PALETTE.length];
  switch (dim) {
    case "project": {
      const p = L.project.get(key);
      return { label: p?.name ?? "—", sub: p?.client ?? undefined, color: p?.color ?? fallback };
    }
    case "user": {
      const p = L.person.get(key);
      return {
        label: p?.full_name || p?.email || "—",
        sub: p?.department_id ? L.dept.get(p.department_id)?.name : undefined,
        color: fallback,
      };
    }
    case "department":
      return { label: key === "none" ? "Sin departamento" : (L.dept.get(key)?.name ?? "—"), color: fallback };
    case "task": {
      if (key.startsWith("none:")) {
        const p = L.project.get(key.slice(5));
        return { label: "Sin subtarea", sub: p?.name, color: p?.color ?? fallback };
      }
      const t = L.task.get(key);
      const p = t ? L.project.get(t.project_id) : undefined;
      return { label: t?.name ?? "—", sub: p?.name, color: p?.color ?? fallback };
    }
    case "client":
      return { label: key === "none" ? "Sin cliente" : key, color: fallback };
  }
}

function pickBucket(period: Period, entries: RawEntry[]): Bucket {
  const start = period.from ?? (entries[0] ? new Date(entries[0].started_at) : new Date());
  const end = period.to ?? new Date();
  const days = (end.getTime() - start.getTime()) / 864e5;
  if (days <= 62) return "day";
  if (days <= 190) return "week";
  return "month";
}

function bucketOf(d: TZDate, b: Bucket) {
  if (b === "day") return format(d, "yyyy-MM-dd");
  if (b === "week") return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
  return format(startOfMonth(d), "yyyy-MM");
}

function* bucketsBetween(from: TZDate, to: TZDate, b: Bucket) {
  let cur =
    b === "day"
      ? new TZDate(from.getFullYear(), from.getMonth(), from.getDate(), from.timeZone!)
      : b === "week"
        ? startOfWeek(from, { weekStartsOn: 1 })
        : startOfMonth(from);
  let guard = 0;
  while (cur < to && guard++ < 1000) {
    yield cur;
    cur =
      b === "day"
        ? new TZDate(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, from.timeZone!)
        : b === "week"
          ? new TZDate(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7, from.timeZone!)
          : new TZDate(cur.getFullYear(), cur.getMonth() + 1, 1, from.timeZone!);
  }
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function bucketLabel(d: TZDate, b: Bucket) {
  if (b === "month") return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const secs = (e: RawEntry) => (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 1000;

export function buildReport(entries: RawEntry[], f: Filters, period: Period, lookup: Lookup): Report {
  const tz = lookup.settings.tz;
  const L = makeLabeler(lookup);
  const dim = f.groupBy;

  // Agrupación principal
  const acc = new Map<string, { seconds: number; entries: number; people: Set<string> }>();
  const people = new Set<string>();
  const days = new Set<string>();
  const personDays = new Set<string>();
  let total = 0;
  for (const e of entries) {
    const s = secs(e);
    total += s;
    people.add(e.user_id);
    const day = format(new TZDate(e.started_at, tz), "yyyy-MM-dd");
    days.add(day);
    personDays.add(`${e.user_id}|${day}`);
    const k = groupKeyOf(e, dim, L);
    const g = acc.get(k) ?? { seconds: 0, entries: 0, people: new Set() };
    g.seconds += s;
    g.entries++;
    g.people.add(e.user_id);
    acc.set(k, g);
  }
  const groups: GroupRow[] = [...acc.entries()]
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .map(([key, g], i) => ({
      key,
      ...describe(key, dim, L, i),
      seconds: g.seconds,
      entries: g.entries,
      people: g.people.size,
    }));

  // Serie temporal apilada: top 6 grupos + "Otros"
  const bucket = pickBucket(period, entries);
  const top = groups.slice(0, 6);
  const topKeys = new Set(top.map((g) => g.key));
  const seriesKeys = top.map((g) => ({ key: g.key, label: g.label, color: g.color }));
  if (groups.length > 6) seriesKeys.push({ key: "__other", label: "Otros", color: OTHER_COLOR });

  const series = new Map<string, SeriesPoint>();
  const from = period.from
    ? new TZDate(period.from, tz)
    : entries[0]
      ? new TZDate(entries[0].started_at, tz)
      : null;
  const to = period.to ? new TZDate(period.to, tz) : new TZDate(Date.now(), tz);
  if (from) {
    for (const b of bucketsBetween(from, to, bucket)) {
      const point: SeriesPoint = { bucket: bucketOf(b, bucket), label: bucketLabel(b, bucket) };
      for (const k of seriesKeys) point[k.key] = 0;
      series.set(point.bucket, point);
    }
  }
  for (const e of entries) {
    const bk = bucketOf(new TZDate(e.started_at, tz), bucket);
    const point = series.get(bk);
    if (!point) continue;
    const gk = groupKeyOf(e, dim, L);
    const key = topKeys.has(gk) ? gk : "__other";
    point[key] = (point[key] as number) + secs(e) / 3600;
  }
  for (const p of series.values())
    for (const k of seriesKeys) p[k.key] = Math.round((p[k.key] as number) * 100) / 100;

  // Matriz personas × proyectos
  const cells: Record<string, Record<string, number>> = {};
  const rowIds = new Set<string>();
  const colIds = new Set<string>();
  for (const e of entries) {
    rowIds.add(e.user_id);
    colIds.add(e.project_id);
    (cells[e.user_id] ??= {})[e.project_id] = (cells[e.user_id][e.project_id] ?? 0) + secs(e);
  }
  const rows = [...rowIds]
    .map((id) => ({ id, label: L.person.get(id)?.full_name || L.person.get(id)?.email || "—" }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  const cols = [...colIds]
    .map((id) => ({ id, label: L.project.get(id)?.name ?? "—", color: L.project.get(id)?.color ?? OTHER_COLOR }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  return {
    totalSeconds: total,
    entries: entries.length,
    people: people.size,
    activeDays: days.size,
    personDays: personDays.size,
    groups,
    series: [...series.values()],
    seriesKeys,
    bucket,
    matrix: { rows, cols, cells },
  };
}
