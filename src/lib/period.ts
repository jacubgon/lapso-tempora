import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { es } from "date-fns/locale";

export type PeriodKind = "week" | "month" | "year" | "cycle" | "all" | "custom";

export const PERIOD_OPTIONS: { id: PeriodKind; label: string }[] = [
  { id: "week", label: "Semana" },
  { id: "cycle", label: "Ciclo de reunión" },
  { id: "month", label: "Mes" },
  { id: "year", label: "Año" },
  { id: "all", label: "Total" },
  { id: "custom", label: "Personalizado" },
];

export type PeriodParams = { p?: string; d?: string; desde?: string; hasta?: string };

export type PeriodConfig = {
  tz: string;
  cycleAnchor: string | null;
  cycleDays: number;
};

export type Period = {
  kind: PeriodKind;
  /** Inicio incluido (null = sin límite) */
  from: Date | null;
  /** Fin excluido (null = sin límite) */
  to: Date | null;
  label: string;
  /** Día de referencia yyyy-MM-dd para navegar */
  ref: string;
  prevRef: string | null;
  nextRef: string | null;
  /** Rango en días locales (inclusive) para mostrar/exportar */
  fromDay: string | null;
  toDay: string | null;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDay(s: string | undefined | null, tz: string): TZDate | null {
  if (!s || !DAY_RE.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = new TZDate(y, m - 1, d, tz);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

function range(a: Date, b: Date) {
  const sameYear = a.getFullYear() === b.getFullYear();
  return `${format(a, sameYear ? "d MMM" : "d MMM yyyy", { locale: es })} – ${format(b, "d MMM yyyy", { locale: es })}`;
}

export function resolvePeriod(params: PeriodParams, cfg: PeriodConfig, now = new Date()): Period {
  const kinds = PERIOD_OPTIONS.map((o) => o.id);
  let kind = (kinds.includes(params.p as PeriodKind) ? params.p : "week") as PeriodKind;
  if (kind === "cycle" && !parseDay(cfg.cycleAnchor, cfg.tz)) kind = "week";

  const today = new TZDate(now, cfg.tz);
  const todayStart = new TZDate(today.getFullYear(), today.getMonth(), today.getDate(), cfg.tz);
  const ref = parseDay(params.d, cfg.tz) ?? todayStart;

  const make = (from: Date, to: Date, label: string, shift: (d: Date, n: number) => Date): Period => ({
    kind,
    from,
    to,
    label,
    ref: dayKey(ref),
    prevRef: dayKey(shift(ref, -1)),
    nextRef: from <= todayStart && todayStart < to ? null : dayKey(shift(ref, 1)),
    fromDay: dayKey(from),
    toDay: dayKey(addDays(to, -1)),
  });

  switch (kind) {
    case "week": {
      const from = startOfWeek(ref, { weekStartsOn: 1 });
      const to = addWeeks(from, 1);
      return make(from, to, range(from, addDays(to, -1)), addWeeks);
    }
    case "month": {
      const from = startOfMonth(ref);
      const label = format(from, "MMMM yyyy", { locale: es });
      return make(from, addMonths(from, 1), label.charAt(0).toUpperCase() + label.slice(1), addMonths);
    }
    case "year": {
      const from = startOfYear(ref);
      return make(from, addYears(from, 1), format(from, "yyyy"), addYears);
    }
    case "cycle": {
      const anchor = parseDay(cfg.cycleAnchor, cfg.tz)!;
      const n = cfg.cycleDays;
      const idx = Math.floor(differenceInCalendarDays(ref, anchor) / n);
      const from = addDays(anchor, idx * n);
      const to = addDays(from, n);
      return make(from, to, `Ciclo · ${range(from, addDays(to, -1))}`, (d, k) => addDays(d, k * n));
    }
    case "custom": {
      let from: Date = parseDay(params.desde, cfg.tz) ?? addDays(todayStart, -13);
      let last: Date = parseDay(params.hasta, cfg.tz) ?? todayStart;
      if (last < from) [from, last] = [last, from];
      const to = addDays(last, 1);
      return {
        kind,
        from,
        to,
        label: range(from, last),
        ref: dayKey(ref),
        prevRef: null,
        nextRef: null,
        fromDay: dayKey(from),
        toDay: dayKey(last),
      };
    }
    case "all":
      return {
        kind,
        from: null,
        to: null,
        label: "Todo el histórico",
        ref: dayKey(ref),
        prevRef: null,
        nextRef: null,
        fromDay: null,
        toDay: null,
      };
  }
}
