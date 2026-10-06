"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useIsClient } from "@/lib/hooks";

type SeriesKey = { key: string; label: string; color: string };
type Point = { bucket: string; label: string; [k: string]: number | string };

const fmtH = (h: number) =>
  `${h.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h`;

export function HoursChart({ data, keys, bucketLabel }: { data: Point[]; keys: SeriesKey[]; bucketLabel: string }) {
  const isClient = useIsClient();
  // Con muchas barras, mostramos menos etiquetas en el eje X
  const interval = data.length > 31 ? Math.ceil(data.length / 16) - 1 : data.length > 16 ? 1 : 0;

  return (
    <div>
      <div className="h-72" role="img" aria-label={`Horas por ${bucketLabel}`}>
        {isClient && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 0, left: -14, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "var(--input)" }}
                interval={interval}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const rows = payload.filter((p) => Number(p.value) > 0).reverse();
                  const total = rows.reduce((s, p) => s + Number(p.value), 0);
                  return (
                    <div className="min-w-44 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg shadow-black/10">
                      <p className="mb-1.5 flex justify-between gap-4 font-semibold">
                        <span>{label}</span>
                        <span className="tabular-nums">{fmtH(total)}</span>
                      </p>
                      {rows.map((p) => (
                        <p key={String(p.dataKey)} className="flex items-center justify-between gap-4 py-0.5">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2 rounded-sm" style={{ background: p.color }} />
                            {p.name}
                          </span>
                          <span className="tabular-nums">{fmtH(Number(p.value))}</span>
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              {keys.map((k, i) => (
                <Bar
                  key={k.key}
                  dataKey={k.key}
                  name={k.label}
                  stackId="h"
                  fill={k.color}
                  stroke="var(--background)"
                  strokeWidth={1}
                  radius={i === keys.length - 1 ? [3, 3, 0, 0] : 0}
                  maxBarSize={22}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {keys.length > 1 && (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Leyenda">
          {keys.map((k) => (
            <li key={k.key} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: k.color }} />
              {k.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
