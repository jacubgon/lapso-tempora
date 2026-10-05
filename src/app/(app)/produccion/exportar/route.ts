import { NextRequest, NextResponse } from "next/server";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import * as XLSX from "xlsx-js-style";
import { createClient } from "@/lib/supabase/server";
import { brand } from "@/config/brand";
import {
  DIMENSIONS,
  applyFilters,
  buildReport,
  fetchAll,
  loadLookup,
  makeLabeler,
  parseFilters,
  periodFor,
  type ReportSearchParams,
} from "@/lib/reports";

type Cell = string | number;
type Sheet = { name: string; header: string[]; rows: Cell[][]; widths?: number[] };

const hours = (secs: number) => Math.round((secs / 3600) * 100) / 100;
const hhmm = (secs: number) => {
  const m = Math.round(secs / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  if (me?.role !== "admin" || !me.active) return new NextResponse("Sin permiso", { status: 403 });

  const sp = Object.fromEntries(request.nextUrl.searchParams) as ReportSearchParams & {
    tipo?: string;
    formato?: string;
  };
  const kind = sp.tipo === "detalle" ? "detalle" : "resumen";
  const asCsv = sp.formato === "csv";

  const lookup = await loadLookup(supabase);
  const filters = parseFilters(sp);
  const period = periodFor(sp, lookup);
  const tz = lookup.settings.tz;
  const L = makeLabeler(lookup);

  type Entry = {
    user_id: string;
    title: string;
    project_id: string;
    task_id: string | null;
    started_at: string;
    ended_at: string;
    source: string;
    created_at: string;
    updated_at: string;
  };
  const entries = await fetchAll<Entry>((from, to) =>
    applyFilters(
      supabase
        .from("time_entries")
        .select("user_id, title, project_id, task_id, started_at, ended_at, source, created_at, updated_at"),
      filters,
      period,
      lookup,
    )
      .order("started_at", { ascending: true })
      .order("id")
      .range(from, to),
  );

  const sheets: Sheet[] = [];
  const secsOf = (e: Entry) => (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 1000;

  if (kind === "detalle") {
    sheets.push({
      name: "Detalle",
      header: ["Fecha", "Inicio", "Fin", "Duración", "Horas", "Persona", "Email", "Departamento", "Proyecto", "Cliente", "Subtarea", "Título", "Origen", "Editada"],
      widths: [11, 7, 7, 9, 8, 22, 26, 16, 22, 18, 20, 40, 11, 8],
      rows: entries.map((e) => {
        const s = new TZDate(e.started_at, tz);
        const en = new TZDate(e.ended_at, tz);
        const p = L.person.get(e.user_id);
        const pr = L.project.get(e.project_id);
        const edited = new Date(e.updated_at).getTime() - new Date(e.created_at).getTime() > 60_000;
        return [
          format(s, "yyyy-MM-dd"),
          format(s, "HH:mm"),
          format(en, "HH:mm"),
          hhmm(secsOf(e)),
          hours(secsOf(e)),
          p?.full_name ?? "",
          p?.email ?? "",
          p?.department_id ? (L.dept.get(p.department_id)?.name ?? "") : "",
          pr?.name ?? "",
          pr?.client ?? "",
          e.task_id ? (L.task.get(e.task_id)?.name ?? "") : "",
          e.title,
          e.source === "timer" ? "Cronómetro" : "Manual",
          edited ? "Sí" : "No",
        ];
      }),
    });
  } else {
    const report = buildReport(entries, filters, period, lookup);
    const dimLabel = DIMENSIONS.find((d) => d.id === filters.groupBy)!.label;
    sheets.push({
      name: "Resumen",
      header: [dimLabel, "Detalle", "Horas", "Duración", "%", "Personas", "Entradas"],
      widths: [26, 22, 10, 10, 8, 10, 10],
      rows: [
        ...report.groups.map((g) => [
          g.label,
          g.sub ?? "",
          hours(g.seconds),
          hhmm(g.seconds),
          report.totalSeconds ? Math.round((g.seconds / report.totalSeconds) * 1000) / 10 : 0,
          g.people,
          g.entries,
        ]),
        ["Total", "", hours(report.totalSeconds), hhmm(report.totalSeconds), 100, report.people, report.entries],
      ],
    });
    const { rows, cols, cells } = report.matrix;
    sheets.push({
      name: "Personas x proyectos",
      header: ["Persona", ...cols.map((c) => c.label), "Total"],
      widths: [22, ...cols.map(() => 14), 10],
      rows: rows.map((r) => {
        const vals = cols.map((c) => hours(cells[r.id]?.[c.id] ?? 0));
        return [r.label, ...vals, Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100];
      }),
    });
    sheets.push({
      name: "Por periodo",
      header: ["Periodo", ...report.seriesKeys.map((k) => k.label), "Total"],
      widths: [12, ...report.seriesKeys.map(() => 14), 10],
      rows: report.series.map((p) => {
        const vals = report.seriesKeys.map((k) => Number(p[k.key]) || 0);
        return [p.bucket, ...vals, Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100];
      }),
    });
  }

  const range = period.fromDay ? `${period.fromDay}_${period.toDay}` : "total";
  const base = `${brand.name.toLowerCase()}-${kind}-${range}`;

  if (asCsv) {
    // Formato "Excel en español": separador ; y coma decimal, con BOM para las tildes.
    const sheet = sheets[0];
    const esc = (v: Cell) => {
      const s = typeof v === "number" ? v.toLocaleString("es-ES", { useGrouping: false, maximumFractionDigits: 2 }) : v;
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [sheet.header, ...sheet.rows].map((r) => r.map(esc).join(";")).join("\r\n");
    return new NextResponse(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.header, ...s.rows]);
    ws["!cols"] = (s.widths ?? []).map((wch) => ({ wch }));
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: s.rows.length, c: s.header.length - 1 } }) };
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    for (let c = 0; c < s.header.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[ref])
        ws[ref].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "2A78D6" } },
          alignment: { vertical: "center" },
        };
    }
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
