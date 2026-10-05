import { requireAdmin } from "@/lib/session";
import { Card } from "@/components/ui";
import { ReportFilters } from "@/components/reports/report-filters";
import { ExportLinks, GroupBySelect } from "@/components/reports/report-controls";
import { HoursChart } from "@/components/reports/hours-chart";
import { GroupTable, MatrixTable, StatTiles } from "@/components/reports/report-tables";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Informes</h1>
          <p className="text-sm text-muted-foreground">Horas del equipo por periodo, persona y proyecto.</p>
        </div>
        <ExportLinks kind="resumen" />
      </div>

      <ReportFilters
        lookup={{ ...lookup, hasCycle: !!lookup.settings.cycleAnchor }}
        period={period}
      />

      {!lookup.settings.cycleAnchor && (
        <p className="text-xs text-muted-foreground">
          Consejo: en <a href="/produccion/gestion?tab=ajustes" className="underline">Gestión → Ajustes</a> puedes
          indicar la fecha de una reunión general para ver los ciclos de reunión a reunión.
        </p>
      )}

      <StatTiles report={report} />

      {report.entries === 0 ? (
        <Card className="px-6 py-14 text-center">
          <p className="font-medium">Sin horas en este periodo</p>
          <p className="mt-1 text-sm text-muted-foreground">Prueba con otro periodo o quita algún filtro.</p>
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">
                Horas por {BUCKET_LABEL[report.bucket]} · por {dimLabel.toLowerCase()}
              </h2>
              <GroupBySelect options={DIMENSIONS} value={filters.groupBy} />
            </div>
            <HoursChart data={report.series} keys={report.seriesKeys} bucketLabel={BUCKET_LABEL[report.bucket]} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 text-sm font-semibold">Reparto por {dimLabel.toLowerCase()}</h2>
            <GroupTable rows={report.groups} total={report.totalSeconds} dimLabel={dimLabel} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 text-sm font-semibold">Personas × proyectos (horas)</h2>
            <MatrixTable matrix={report.matrix} />
          </Card>
        </>
      )}
    </div>
  );
}
