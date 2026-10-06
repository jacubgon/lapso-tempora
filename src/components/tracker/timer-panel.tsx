"use client";

import { useEffect, useState, useTransition } from "react";
import { addHours, format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Input, Label } from "@/components/ui";
import { brand } from "@/config/brand";
import { useNow } from "@/lib/hooks";
import { entrySeconds, formatClock, formatDuration } from "@/lib/utils";
import type { Project, Task, TimeEntry } from "@/lib/types";
import { discardTimer, startTimer, stopTimer, updateRunning } from "@/app/(app)/actions";
import { EntryFields, emptyFields, fieldsFromEntry, type FieldsValue } from "./entry-fields";

type Props = { running: TimeEntry | null; projects: Project[]; tasks: Task[] };

/** A partir de aquí sospechamos que el cronómetro se quedó en marcha sin querer. */
const LONG_TIMER_HOURS = 9;

/** Montar con key={running?.id ?? "idle"} para reiniciar el estado al cambiar de entrada. */
export function TimerPanel({ running, projects, tasks }: Props) {
  const [fields, setFields] = useState<FieldsValue>(() =>
    running ? fieldsFromEntry(running, tasks) : emptyFields,
  );
  const [saved, setSaved] = useState(fields);
  const [fixOpen, setFixOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const now = useNow(!!running);
  const seconds = running ? entrySeconds(running, now) : 0;
  const elapsed = formatClock(seconds);
  const startedAt = running ? new Date(running.started_at) : null;
  const suspicious =
    !!startedAt && (seconds > LONG_TIMER_HOURS * 3600 || !isSameDay(startedAt, new Date(now)));

  // El tiempo en marcha también se ve en la pestaña del navegador
  useEffect(() => {
    if (!running) return;
    const prev = document.title;
    document.title = `${elapsed} · ${fields.title || "Sin título"} · ${brand.name}`;
    return () => {
      document.title = prev;
    };
  }, [running, elapsed, fields.title]);

  function commit(v: FieldsValue) {
    if (!running) return;
    if (v.title === saved.title && v.projectId === saved.projectId && v.taskName === saved.taskName) return;
    setSaved(v);
    startTransition(async () => {
      const r = await updateRunning(running.id, v);
      if (!r.ok) toast.error(r.error);
    });
  }

  function onStart() {
    startTransition(async () => {
      const r = await startTimer(fields);
      if (!r.ok) toast.error(r.error);
    });
  }

  function stop(endedAt?: string) {
    startTransition(async () => {
      const r = await stopTimer(running!.id, fields, endedAt);
      if (r.ok) {
        setFixOpen(false);
        toast.success("Tiempo registrado");
      } else toast.error(r.error);
    });
  }

  function onDiscard() {
    if (!confirm("¿Descartar este cronómetro? El tiempo no se guardará.")) return;
    startTransition(async () => {
      const r = await discardTimer(running!.id);
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <>
      {suspicious && startedAt && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[#eda100]/50 bg-[#eda100]/10 px-3 py-2 text-sm"
        >
          <AlertTriangle className="size-4 shrink-0 text-[#b37a00] dark:text-[#eda100]" />
          <p className="min-w-0 flex-1">
            <strong>¿Se te olvidó pararlo?</strong> Lleva {formatDuration(seconds)} en marcha, desde el{" "}
            {format(startedAt, "EEEE d 'a las' HH:mm", { locale: es })}.
          </p>
          <Button size="sm" variant="secondary" onClick={() => setFixOpen(true)}>
            Ajustar hora de fin
          </Button>
        </div>
      )}

      <form
        className="flex flex-col gap-4 md:flex-row md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!running) return onStart();
          // Si parece olvidado, pedimos confirmar o ajustar la hora en vez de guardar sin más
          if (suspicious) setFixOpen(true);
          else stop();
        }}
      >
        <div className="min-w-0 flex-1">
          <EntryFields
            layout="inline"
            value={fields}
            onChange={setFields}
            onCommit={commit}
            projects={projects}
            tasks={tasks}
          />
        </div>
        <div className="order-first flex items-end justify-between gap-4 md:order-none md:justify-end">
          <div>
            {running && startedAt && (
              <p className="eyebrow mb-1 flex items-center gap-1.5 !text-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                En marcha · desde {format(startedAt, "HH:mm")}
              </p>
            )}
            <span
              className={`text-5xl font-medium leading-none tracking-[-0.05em] tabular-nums md:text-4xl ${running ? "text-foreground" : "text-muted-foreground/50"}`}
              aria-live="off"
            >
              {elapsed.slice(0, -3)}
              <span className="text-muted-foreground/50">{elapsed.slice(-3)}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {running && (
              <Button variant="ghost" size="icon" onClick={onDiscard} disabled={pending} title="Descartar">
                <Trash2 className="size-4" />
              </Button>
            )}
            {running ? (
              <Button type="submit" disabled={pending} className="w-28">
                <Square className="size-3.5 fill-current" /> Parar
              </Button>
            ) : (
              <Button type="submit" disabled={pending} className="w-28">
                <Play className="size-3.5 fill-current" /> Empezar
              </Button>
            )}
          </div>
        </div>
      </form>

      {running && startedAt && (
        <Dialog open={fixOpen} onClose={() => setFixOpen(false)} title="¿Cuándo terminaste?">
          <FixEndForm
            startedAt={startedAt}
            seconds={seconds}
            now={now}
            pending={pending}
            onStopNow={() => stop()}
            onStopAt={(iso) => stop(iso)}
          />
        </Dialog>
      )}
    </>
  );
}

function FixEndForm({
  startedAt,
  seconds,
  now,
  pending,
  onStopNow,
  onStopAt,
}: {
  startedAt: Date;
  seconds: number;
  now: number;
  pending: boolean;
  onStopNow: () => void;
  onStopAt: (iso: string) => void;
}) {
  // Propuesta: 8 h después del inicio (o ahora, si es antes)
  const [initial] = useState(() => {
    const guess = new Date(Math.min(addHours(startedAt, 8).getTime(), Date.now()));
    return { date: format(guess, "yyyy-MM-dd"), time: format(guess, "HH:mm") };
  });
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const end = new Date(`${date}T${time}`);
  const valid = !Number.isNaN(end.getTime()) && end > startedAt && end.getTime() <= now + 60_000;
  const duration = valid ? (end.getTime() - startedAt.getTime()) / 1000 : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Empezaste el <strong className="text-foreground">{format(startedAt, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}</strong>{" "}
        y el cronómetro lleva {formatDuration(seconds)}. Indica la hora real a la que terminaste.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="fix-date">Fecha de fin</Label>
          <Input id="fix-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="fix-time">Hora de fin</Label>
          <Input id="fix-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <p className="text-sm">
        {valid ? (
          <>
            Se registrarán <strong>{formatDuration(duration)}</strong>.
          </>
        ) : (
          <span className="text-destructive">La hora debe ser posterior al inicio y no puede ser futura.</span>
        )}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onStopNow} disabled={pending}>
          No, he trabajado todo ese tiempo
        </Button>
        <Button onClick={() => onStopAt(end.toISOString())} disabled={pending || !valid}>
          Parar con esta hora
        </Button>
      </div>
    </div>
  );
}
