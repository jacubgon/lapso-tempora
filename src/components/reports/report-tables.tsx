import { formatDuration, formatHours } from "@/lib/utils";
import type { GroupRow, Report } from "@/lib/reports";

/** La cifra de horas como protagonista, con el resto de indicadores en una línea. */
export function HeroStats({ report, eyebrow }: { report: Report; eyebrow: string }) {
  const avg = report.personDays ? report.totalSeconds / report.personDays : 0;
  const hours = Math.floor(report.totalSeconds / 3600);
  const minutes = Math.round((report.totalSeconds % 3600) / 60);
  const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-ES")} ${n === 1 ? one : many}`;
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <p className="mt-2 text-6xl font-semibold leading-none tracking-[-0.04em] sm:text-7xl">
        {hours.toLocaleString("es-ES")}
        <span className="ml-2 text-2xl font-medium tracking-normal text-muted-foreground sm:text-3xl">
          {hours === 1 ? "hora" : "horas"}
          {minutes > 0 && ` ${minutes} min`}
        </span>
      </p>
      <p className="mt-3 text-[15px] text-muted-foreground">
        {plural(report.people, "persona", "personas")} · {plural(report.entries, "entrada", "entradas")} · media de{" "}
        {formatDuration(avg)} por persona y día
      </p>
    </div>
  );
}

const th = "eyebrow py-2.5 font-normal";

export function GroupTable({ rows, total, dimLabel }: { rows: GroupRow[]; total: number; dimLabel: string }) {
  const max = rows[0]?.seconds ?? 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className={`${th} pr-4`}>{dimLabel}</th>
            <th className={`${th} pr-4 text-right`}>Horas</th>
            <th className={`${th} pr-4 text-right`}>%</th>
            <th className={`${th} hidden pr-4 text-right sm:table-cell`}>Personas</th>
            <th className={`${th} hidden text-right sm:table-cell`}>Entradas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border">
              <td className="py-2.5 pr-4">
                <p className="font-semibold">{r.label}</p>
                {r.sub && <p className="text-xs text-muted-foreground">{r.sub}</p>}
                <div className="mt-1.5 h-[3px] rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${max ? (r.seconds / max) * 100 : 0}%`, background: r.color }}
                  />
                </div>
              </td>
              <td className="py-2.5 pr-4 text-right font-mono">{formatHours(r.seconds)}</td>
              <td className="py-2.5 pr-4 text-right font-mono text-muted-foreground">
                {total ? ((r.seconds / total) * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 }) : 0}
              </td>
              <td className="hidden py-2.5 pr-4 text-right font-mono text-muted-foreground sm:table-cell">{r.people}</td>
              <td className="hidden py-2.5 text-right font-mono text-muted-foreground sm:table-cell">{r.entries}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-foreground/30 font-semibold">
            <td className="py-2.5 pr-4">Total</td>
            <td className="py-2.5 pr-4 text-right font-mono">{formatHours(total)}</td>
            <td className="py-2.5 pr-4 text-right font-mono text-muted-foreground">100</td>
            <td colSpan={2} className="hidden sm:table-cell" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Personas × proyectos, con intensidad proporcional a las horas (rampa de un solo tono: el acento). */
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
          <tr>
            <th className={`${th} pr-3 text-left`}>Persona</th>
            {matrix.cols.map((c) => (
              <th key={c.id} className="px-2 py-2.5 text-right text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span className="size-2 rounded-full" style={{ background: c.color }} />
                  {c.label}
                </span>
              </th>
            ))}
            <th className={`${th} pl-2 text-right`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => {
            const rowTotal = matrix.cols.reduce((s, c) => s + (matrix.cells[r.id]?.[c.id] ?? 0), 0);
            return (
              <tr key={r.id} className="border-t border-border">
                <td className="whitespace-nowrap py-2 pr-3 font-medium">{r.label}</td>
                {matrix.cols.map((c) => {
                  const v = matrix.cells[r.id]?.[c.id] ?? 0;
                  const alpha = max ? 0.06 + (v / max) * 0.4 : 0;
                  return (
                    <td
                      key={c.id}
                      className="px-2 py-2 text-right font-mono text-[13px]"
                      style={v ? { background: `color-mix(in oklab, var(--primary) ${alpha * 100}%, transparent)` } : undefined}
                      title={v ? `${r.label} · ${c.label}: ${formatDuration(v)}` : undefined}
                    >
                      {v ? formatHours(v) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                  );
                })}
                <td className="py-2 pl-2 text-right font-mono text-[13px] font-medium">{formatHours(rowTotal)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-foreground/30 font-semibold">
            <td className="py-2 pr-3">Total</td>
            {matrix.cols.map((c) => (
              <td key={c.id} className="px-2 py-2 text-right font-mono text-[13px]">
                {formatHours(colTotals[c.id])}
              </td>
            ))}
            <td className="py-2 pl-2 text-right font-mono text-[13px]">{formatHours(grand)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
