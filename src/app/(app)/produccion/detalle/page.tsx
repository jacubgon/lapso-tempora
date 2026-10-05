import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, ArrowDownUp, ChevronLeft, ChevronRight, PenLine, Timer } from "lucide-react";
import { EntryEditorProvider, EntryRowActions } from "@/components/reports/entry-editor";
import { requireAdmin } from "@/lib/session";
import { Card } from "@/components/ui";
import { ReportFilters } from "@/components/reports/report-filters";
import { ExportLinks } from "@/components/reports/report-controls";
import {
  applyFilters,
  fetchReportEntries,
  loadLookup,
  makeLabeler,
  parseFilters,
  periodFor,
  type ReportSearchParams,
} from "@/lib/reports";
import { formatDuration, formatHours } from "@/lib/utils";

export const metadata = { title: "Detalle" };

const PAGE_SIZE = 100;
/** Entradas más largas se marcan como posible cronómetro olvidado. */
const LONG_ENTRY_HOURS = 10;

type Row = {
  id: string;
  user_id: string;
  title: string;
  project_id: string;
  task_id: string | null;
  started_at: string;
  ended_at: string;
  source: "timer" | "manual";
  created_at: string;
  updated_at: string;
};

export default async function DetallePage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const lookup = await loadLookup(supabase);
  const filters = parseFilters(sp);
  const period = periodFor(sp, lookup);
  const ascending = sp.orden !== "desc";
  const page = Math.max(1, Number(sp.pagina) || 1);
  const tz = lookup.settings.tz;
  const L = makeLabeler(lookup);

  const [pageRes, all] = await Promise.all([
    applyFilters(
      supabase
        .from("time_entries")
        .select("id, user_id, title, project_id, task_id, started_at, ended_at, source, created_at, updated_at", {
          count: "exact",
        }),
      filters,
      period,
      lookup,
    )
      .order("started_at", { ascending })
      .order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    fetchReportEntries(supabase, filters, period, lookup),
  ]);

  const rows = (pageRes.data ?? []) as Row[];
  const count = pageRes.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const totalSeconds = all.reduce(
    (s, e) => s + (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 1000,
    0,
  );

  // Subtotales por día sobre el total filtrado (no solo la página)
  const dayTotals = new Map<string, number>();
  for (const e of all) {
    const k = format(new TZDate(e.started_at, tz), "yyyy-MM-dd");
    dayTotals.set(k, (dayTotals.get(k) ?? 0) + (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 1000);
  }

  const qs = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    return `?${next.toString()}`;
  };

  const dayOf = (iso: string) => format(new TZDate(iso, tz), "yyyy-MM-dd");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Detalle de entradas</h1>
          <p className="text-sm text-muted-foreground">Todas las entradas de tiempo, en orden cronológico.</p>
        </div>
        <ExportLinks kind="detalle" />
      </div>

      <ReportFilters lookup={{ ...lookup, hasCycle: !!lookup.settings.cycleAnchor }} period={period} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          <strong className="text-foreground">{count.toLocaleString("es-ES")}</strong> entradas ·{" "}
          <strong className="text-foreground">{formatHours(totalSeconds)} h</strong> ({formatDuration(totalSeconds)})
        </p>
        <Link
          href={qs({ orden: ascending ? "desc" : null, pagina: null })}
          scroll={false}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowDownUp className="size-4" /> {ascending ? "Más antiguas primero" : "Más recientes primero"}
        </Link>
      </div>

      <EntryEditorProvider lookup={{ projects: lookup.projects, tasks: lookup.tasks, people: lookup.people }}>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-muted-foreground">No hay entradas con estos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Horario</th>
                  <th className="px-3 py-2.5 text-right font-medium">Duración</th>
                  <th className="px-3 py-2.5 font-medium">Persona</th>
                  <th className="px-3 py-2.5 font-medium">Proyecto · subtarea</th>
                  <th className="px-3 py-2.5 font-medium">Título</th>
                  <th className="px-3 py-2.5 font-medium">
                    <span className="sr-only">Origen</span>
                  </th>
                  <th className="px-2 py-2.5 font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => {
                  const start = new TZDate(e.started_at, tz);
                  const end = new TZDate(e.ended_at, tz);
                  const day = dayOf(e.started_at);
                  const showDay = i === 0 || dayOf(rows[i - 1].started_at) !== day;
                  const person = L.person.get(e.user_id);
                  const project = L.project.get(e.project_id);
                  const task = e.task_id ? L.task.get(e.task_id) : undefined;
                  const dept = person?.department_id ? L.dept.get(person.department_id) : undefined;
                  const edited = new Date(e.updated_at).getTime() - new Date(e.created_at).getTime() > 60_000;
                  const secs = (end.getTime() - start.getTime()) / 1000;
                  const dayLabel = format(start, "EEEE d 'de' MMMM yyyy", { locale: es });
                  return [
                    showDay && (
                      <tr key={`d-${day}`} className="border-t border-border bg-muted/30">
                        <td colSpan={7} className="px-4 py-1.5 text-xs font-semibold">
                          <span className="capitalize">{dayLabel}</span>
                          <span className="float-right tabular-nums text-muted-foreground">
                            {formatDuration(dayTotals.get(day) ?? 0)}
                          </span>
                        </td>
                      </tr>
                    ),
                    <tr key={e.id} className="border-t border-border/60 align-top">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                        {format(start, "HH:mm")} – {format(end, "HH:mm")}
                        {format(end, "yyyy-MM-dd") !== day && <span className="text-xs text-muted-foreground"> (+1)</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">
                        {formatDuration(secs)}
                        {secs > LONG_ENTRY_HOURS * 3600 && (
                          <span
                            className="ml-1 inline-flex align-middle text-[#b37a00] dark:text-[#eda100]"
                            title={`Más de ${LONG_ENTRY_HOURS} h: ¿cronómetro olvidado?`}
                          >
                            <AlertTriangle className="size-3.5" />
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="whitespace-nowrap font-medium">{person?.full_name || person?.email}</p>
                        {dept && <p className="text-xs text-muted-foreground">{dept.name}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="size-2 rounded-sm" style={{ background: project?.color }} />
                          {project?.name}
                        </p>
                        {task && <p className="text-xs text-muted-foreground">{task.name}</p>}
                      </td>
                      <td className="min-w-48 px-3 py-2.5">{e.title}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1" title={e.source === "timer" ? "Cronómetro" : "Manual"}>
                          {e.source === "timer" ? <Timer className="size-3.5" /> : <PenLine className="size-3.5" />}
                          {edited && (
                            <span
                              className="rounded bg-muted px-1.5 py-0.5"
                              title={`Editada el ${format(new TZDate(e.updated_at, tz), "d/MM/yyyy HH:mm")}`}
                            >
                              editada
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-1">
                        <EntryRowActions entry={e} who={person?.full_name || person?.email || ""} />
                      </td>
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </EntryEditorProvider>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2 text-sm" aria-label="Paginación">
          <Link
            href={qs({ pagina: page > 2 ? String(page - 1) : null })}
            aria-disabled={page <= 1}
            className={`inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted"}`}
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="px-2 text-muted-foreground">
            Página <strong className="text-foreground">{page}</strong> de {pages}
          </span>
          <Link
            href={qs({ pagina: String(page + 1) })}
            aria-disabled={page >= pages}
            className={`inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-muted"}`}
          >
            <ChevronRight className="size-4" />
          </Link>
        </nav>
      )}
    </div>
  );
}
