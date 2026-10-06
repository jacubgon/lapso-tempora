import { requireAdmin } from "@/lib/session";
import { ReportFilters } from "@/components/reports/report-filters";
import { ExportLinks, GroupBySelect } from "@/components/reports/report-controls";
import { HoursChart } from "@/components/reports/hours-chart";
import { GroupTable, HeroStats, MatrixTable } from "@/components/reports/report-tables";
import { PERIOD_OPTIONS } from "@/lib/period";
import {
  DIMENSIONS,
  buildReport,
  fetchReportEntries,
  loadLookup,
  parseFilters,
  periodFor,
  type ReportSearchParams,
} from "@/lib/reports";

export const metadata = { title: "Informes" };

const BUCKET_LABEL = { day: "día", week: "semana", month: "mes" } as const;

export default async function InformesPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const lookup = await loadLookup(supabase);
  const filters = parseFilters(sp);
  const period = periodFor(sp, lookup);
  const entries = await fetchReportEntries(supabase, filters, period, lookup);
  const report = buildReport(entries, filters, period, lookup);
  const dimLabel = DIMENSIONS.find((d) => d.id === filters.groupBy)!.label;
  const kindLabel = PERIOD_OPTIONS.find((o) => o.id === period.kind)!.label;
  const eyebrow = period.kind === "cycle" ? period.label.replace("Ciclo ·", "Ciclo de reunión ·") : `${kindLabel} · ${period.label}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <HeroStats report={report} eyebrow={period.kind === "all" ? period.label : eyebrow} />
        <ExportLinks kind="resumen" />
      </div>

      <div className="border-y border-border py-3.5">
        <ReportFilters lookup={{ ...lookup, hasCycle: !!lookup.settings.cycleAnchor }} period={period} />
      </div>

      {!lookup.settings.cycleAnchor && (
        <p className="text-xs text-muted-foreground">
          Consejo: en <a href="/produccion/gestion?tab=ajustes" className="underline">Gestión → Ajustes</a> puedes
          indicar la fecha de una reunión general para ver los ciclos de reunión a reunión.
        </p>
      )}

      {report.entries === 0 ? (
        <div className="py-16 text-center">
          <p className="text-lg font-semibold">Sin horas en este periodo</p>
          <p className="mt-1 text-sm text-muted-foreground">Prueba con otro periodo o quita algún filtro.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <section>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight">Horas por {BUCKET_LABEL[report.bucket]}</h2>
                <span className="text-sm text-muted-foreground">por {dimLabel.toLowerCase()}</span>
              </div>
              <HoursChart data={report.series} keys={report.seriesKeys} bucketLabel={BUCKET_LABEL[report.bucket]} />
            </section>

            <section>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight">Reparto por {dimLabel.toLowerCase()}</h2>
                <GroupBySelect options={DIMENSIONS} value={filters.groupBy} />
              </div>
              <GroupTable rows={report.groups} total={report.totalSeconds} dimLabel={dimLabel} />
            </section>
          </div>

          <section className="border-t border-border pt-8">
            <h2 className="mb-2 text-lg font-semibold tracking-tight">Personas × proyectos</h2>
            <p className="mb-4 text-sm text-muted-foreground">Horas de cada persona en cada proyecto; más intenso, más horas.</p>
            <MatrixTable matrix={report.matrix} />
          </section>
        </>
      )}
    </div>
  );
}
