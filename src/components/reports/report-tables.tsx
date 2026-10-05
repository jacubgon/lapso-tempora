import { Card } from "@/components/ui";
import { formatDuration, formatHours } from "@/lib/utils";
import type { GroupRow, Report } from "@/lib/reports";

export function StatTiles({ report }: { report: Report }) {
  const avg = report.personDays ? report.totalSeconds / report.personDays : 0;
  const tiles = [
    { label: "Horas registradas", value: formatHours(report.totalSeconds), hint: formatDuration(report.totalSeconds) },
    { label: "Personas", value: String(report.people), hint: `${report.activeDays} días con actividad` },
    { label: "Media por persona y día", value: formatDuration(avg), hint: "en días con registros" },
    { label: "Entradas", value: report.entries.toLocaleString("es-ES"), hint: "registros de tiempo" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label} className="p-4">
          <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{t.value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.hint}</p>
        </Card>
      ))}
    </div>
  );
}

export function GroupTable({ rows, total, dimLabel }: { rows: GroupRow[]; total: number; dimLabel: string }) {
  const max = rows[0]?.seconds ?? 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">{dimLabel}</th>
            <th className="w-2/5 py-2 pr-3 font-medium">
              <span className="sr-only">Proporción</span>
            </th>
            <th className="py-2 pr-3 text-right font-medium">Horas</th>
            <th className="py-2 pr-3 text-right font-medium">%</th>
            <th className="py-2 pr-3 text-right font-medium">Personas</th>
            <th className="py-2 text-right font-medium">Entradas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.label}</p>
                    {r.sub && <p className="truncate text-xs text-muted-foreground">{r.sub}</p>}
                  </div>
                </div>
              </td>
              <td className="py-2.5 pr-3">
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${max ? (r.seconds / max) * 100 : 0}%`, background: r.color }}
                  />
                </div>
              </td>
              <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{formatHours(r.seconds)}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                {total ? ((r.seconds / total) * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 }) : 0}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{r.people}</td>
              <td className="py-2.5 text-right tabular-nums text-muted-foreground">{r.entries}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border font-semibold">
            <td className="py-2.5 pr-3">Total</td>
            <td />
            <td className="py-2.5 pr-3 text-right tabular-nums">{formatHours(total)}</td>
            <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">100</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Personas × proyectos, con intensidad proporcional a las horas (rampa secuencial de un solo tono). */
export function MatrixTable({ matrix }: { matrix: Report["matrix"] }) {
  const values = matrix.rows.flatMap((r) => Object.values(matrix.cells[r.id] ?? {}));
  const max = Math.max(0, ...values);
  const colTotals = Object.fromEntries(
    matrix.cols.map((c) => [c.id, matrix.rows.reduce((s, r) => s + (matrix.cells[r.id]?.[c.id] ?? 0), 0)]),
  );
  const grand = Object.values(colTotals).reduce((a, b) => a + b, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="py-2 pr-3 text-left font-medium">Persona</th>
            {matrix.cols.map((c) => (
              <th key={c.id} className="px-2 py-2 text-right font-medium">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span className="size-2 rounded-sm" style={{ background: c.color }} />
                  {c.label}
                </span>
              </th>
            ))}
            <th className="py-2 pl-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => {
            const rowTotal = matrix.cols.reduce((s, c) => s + (matrix.cells[r.id]?.[c.id] ?? 0), 0);
            return (
              <tr key={r.id} className="border-b border-border/60">
                <td className="whitespace-nowrap py-2 pr-3 font-medium">{r.label}</td>
                {matrix.cols.map((c) => {
                  const v = matrix.cells[r.id]?.[c.id] ?? 0;
                  const alpha = max ? 0.08 + (v / max) * 0.5 : 0;
                  return (
                    <td
                      key={c.id}
                      className="px-2 py-2 text-right tabular-nums"
                      style={v ? { background: `color-mix(in oklab, #2a78d6 ${alpha * 100}%, transparent)` } : undefined}
                      title={v ? `${r.label} · ${c.label}: ${formatDuration(v)}` : undefined}
                    >
                      {v ? formatHours(v) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                  );
                })}
                <td className="py-2 pl-2 text-right font-semibold tabular-nums">{formatHours(rowTotal)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-2 pr-3">Total</td>
            {matrix.cols.map((c) => (
              <td key={c.id} className="px-2 py-2 text-right tabular-nums">
                {formatHours(colTotals[c.id])}
              </td>
            ))}
            <td className="py-2 pl-2 text-right tabular-nums">{formatHours(grand)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
