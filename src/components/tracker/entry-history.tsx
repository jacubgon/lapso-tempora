"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { addDays, addWeeks, format, isThisWeek, isToday, isYesterday, startOfWeek, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { Lock, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Dialog } from "@/components/ui";
import { entrySeconds, formatDuration } from "@/lib/utils";
import type { Project, Task, TimeEntry } from "@/lib/types";
import { continueEntry, deleteEntry } from "@/app/(app)/actions";
import { ManualForm } from "./manual-form";

type Props = {
  entries: TimeEntry[];
  projects: Project[];
  tasks: Task[];
  weeks: number;
  lockBefore: string | null;
  canBypassLock: boolean;
};

type Day = { key: string; date: Date; entries: TimeEntry[]; seconds: number };
type Week = { key: string; start: Date; days: Day[]; seconds: number };

function groupByWeek(entries: TimeEntry[], cutoff: Date): Week[] {
  const weeks = new Map<string, Week>();
  for (const e of entries) {
    const start = new Date(e.started_at);
    if (start < cutoff) continue;
    const ws = startOfWeek(start, { weekStartsOn: 1 });
    const wk = format(ws, "yyyy-MM-dd");
    const dk = format(start, "yyyy-MM-dd");
    const secs = entrySeconds(e);

    let week = weeks.get(wk);
    if (!week) weeks.set(wk, (week = { key: wk, start: ws, days: [], seconds: 0 }));
    let day = week.days.find((d) => d.key === dk);
    if (!day) week.days.push((day = { key: dk, date: start, entries: [], seconds: 0 }));
    day.entries.push(e);
    day.seconds += secs;
    week.seconds += secs;
  }
  const sorted = [...weeks.values()].sort((a, b) => b.key.localeCompare(a.key));
  for (const w of sorted) {
    w.days.sort((a, b) => b.key.localeCompare(a.key));
    for (const d of w.days) d.entries.sort((a, b) => b.started_at.localeCompare(a.started_at));
  }
  return sorted;
}

function weekLabel(start: Date) {
  if (isThisWeek(start, { weekStartsOn: 1 })) return "Esta semana";
  if (isThisWeek(addWeeks(start, 1), { weekStartsOn: 1 })) return "Semana pasada";
  const end = addDays(start, 6);
  return `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM yyyy", { locale: es })}`;
}

function dayLabel(d: Date) {
  if (isToday(d)) return "Hoy";
  if (isYesterday(d)) return "Ayer";
  const s = format(d, "EEEE, d 'de' MMMM", { locale: es });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function EntryHistory({ entries, projects, tasks, weeks, lockBefore, canBypassLock }: Props) {
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [deleting, setDeleting] = useState<TimeEntry | null>(null);
  const [pending, startTransition] = useTransition();

  const cutoff = useMemo(() => startOfWeek(subWeeks(new Date(), weeks - 1), { weekStartsOn: 1 }), [weeks]);
  const grouped = useMemo(() => groupByWeek(entries, cutoff), [entries, cutoff]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const isLocked = (e: TimeEntry) =>
    !canBypassLock && !!lockBefore && format(new Date(e.started_at), "yyyy-MM-dd") < lockBefore;

  function onContinue(e: TimeEntry) {
    startTransition(async () => {
      const r = await continueEntry(e.id);
      if (r.ok) {
        toast.success("Cronómetro en marcha");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else toast.error(r.error);
    });
  }

  function onDelete() {
    const target = deleting;
    if (!target) return;
    startTransition(async () => {
      const r = await deleteEntry(target.id);
      if (r.ok) toast.success("Entrada eliminada");
      else toast.error(r.error);
      setDeleting(null);
    });
  }

  if (grouped.length === 0) {
    return (
      <Card className="px-6 py-14 text-center">
        <p className="font-medium">Aún no hay entradas</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Arranca el cronómetro o añade tiempo manualmente para empezar.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map((week) => (
        <section key={week.key}>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-lg font-semibold tracking-tight">{weekLabel(week.start)}</h2>
            <p className="text-sm text-muted-foreground">
              <span className="eyebrow mr-1.5">Total</span>
              <span className="font-semibold text-foreground">{formatDuration(week.seconds)}</span>
            </p>
          </div>

          <div className="space-y-3">
            {week.days.map((day) => (
              <Card key={day.key} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <h3 className="eyebrow">{dayLabel(day.date)}</h3>
                  <span className="font-mono text-xs">{formatDuration(day.seconds)}</span>
                </div>
                <ul className="divide-y divide-border">
                  {day.entries.map((e) => {
                    const p = e.project_id ? projectById.get(e.project_id) : undefined;
                    const t = e.task_id ? taskById.get(e.task_id) : undefined;
                    const locked = isLocked(e);
                    return (
                      <li key={e.id} className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                        <div className="min-w-0 flex-1 basis-60">
                          <p className="truncate text-sm font-semibold">{e.title}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                            <span className="size-2 shrink-0 rounded-full" style={{ background: p?.color ?? "var(--border)" }} />
                            <span className="truncate" style={{ color: p?.color }}>
                              {p?.name ?? "Sin proyecto"}
                            </span>
                            {t && <span className="truncate">· {t.name}</span>}
                          </p>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">
                          {format(new Date(e.started_at), "HH:mm")} – {e.ended_at && format(new Date(e.ended_at), "HH:mm")}
                        </p>
                        <p className="w-20 text-right font-mono text-[13px]">
                          {formatDuration(entrySeconds(e))}
                        </p>
                        <div className="flex w-[6.75rem] justify-end gap-0.5">
                          <Button variant="ghost" size="icon" title="Continuar" disabled={pending} onClick={() => onContinue(e)}>
                            <Play className="size-4" />
                          </Button>
                          {locked ? (
                            <span
                              className="inline-flex size-9 items-center justify-center text-muted-foreground"
                              title="Periodo cerrado: no se puede modificar"
                            >
                              <Lock className="size-4" />
                            </span>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing(e)}>
                                <Pencil className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Eliminar" onClick={() => setDeleting(e)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <div className="flex justify-center">
        <Link
          href={`/?semanas=${weeks + 4}`}
          scroll={false}
          className="btn-outline rounded-lg px-4 py-2 text-sm font-medium"
        >
          Ver semanas anteriores
        </Link>
      </div>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Editar entrada">
        {editing && (
          <ManualForm
            key={editing.id}
            entry={editing}
            projects={projects}
            tasks={tasks}
            layout="dialog"
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="¿Eliminar entrada?">
        <p className="text-sm text-muted-foreground">
          «{deleting?.title}» · {deleting && formatDuration(entrySeconds(deleting))}. Esta acción no se puede deshacer.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onDelete} disabled={pending}>
            Eliminar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
