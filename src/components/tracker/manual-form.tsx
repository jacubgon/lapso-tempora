"use client";

import { useId, useState, useTransition } from "react";
import { addDays, format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Label } from "@/components/ui";
import { formatDuration } from "@/lib/utils";
import type { Project, Task, TimeEntry } from "@/lib/types";
import { saveEntry } from "@/app/(app)/actions";
import { EntryFields, emptyFields, fieldsFromEntry, type FieldsValue } from "./entry-fields";

type Props = {
  projects: Project[];
  tasks: Task[];
  /** Si se pasa, el formulario edita esa entrada. */
  entry?: TimeEntry;
  onDone?: () => void;
  layout?: "panel" | "dialog";
};

function initialTimes(entry?: TimeEntry) {
  if (entry?.ended_at) {
    const s = new Date(entry.started_at);
    const e = new Date(entry.ended_at);
    return { date: format(s, "yyyy-MM-dd"), start: format(s, "HH:mm"), end: format(e, "HH:mm") };
  }
  return { date: format(new Date(), "yyyy-MM-dd"), start: "09:00", end: "" };
}

/** Convierte fecha + horas locales en un rango. Si fin <= inicio, termina al dÃ­a siguiente. */
function toRange(date: string, start: string, end: string) {
  if (!date || !start || !end) return null;
  const s = new Date(`${date}T${start}`);
  let e = new Date(`${date}T${end}`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const overnight = e <= s;
  if (overnight) e = addDays(e, 1);
  return { start: s, end: e, overnight, seconds: (e.getTime() - s.getTime()) / 1000 };
}

export function ManualForm({ projects, tasks, entry, onDone, layout = "panel" }: Props) {
  const [fields, setFields] = useState<FieldsValue>(() =>
    entry ? fieldsFromEntry(entry, tasks) : emptyFields,
  );
  const [times, setTimes] = useState(() => initialTimes(entry));
  const [pending, startTransition] = useTransition();
  const range = toRange(times.date, times.start, times.end);
  const isDialog = layout === "dialog";
  const uid = useId();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!range) {
      toast.error("Indica fecha, hora de inicio y hora de fin.");
      return;
    }
    startTransition(async () => {
      const r = await saveEntry(entry?.id ?? null, {
        ...fields,
        startedAt: range.start.toISOString(),
        endedAt: range.end.toISOString(),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(entry ? "Entrada actualizada" : "Tiempo registrado");
      if (!entry) {
        // Encadenar: la siguiente entrada empieza donde acabÃ³ esta.
        setFields((f) => ({ ...f, title: "" }));
        setTimes({ date: format(range.end, "yyyy-MM-dd"), start: format(range.end, "HH:mm"), end: "" });
      }
      onDone?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <EntryFields
        layout={isDialog ? "stacked" : "inline"}
        value={fields}
        onChange={setFields}
        projects={projects}
        tasks={tasks}
      />
      <div className={isDialog ? "space-y-4" : "flex flex-col gap-3 md:flex-row md:items-end"}>
        <div className="grid flex-1 grid-cols-[1.4fr_1fr_1fr] gap-3 md:max-w-md">
          <div>
            <Label htmlFor={`${uid}-date`}>Fecha</Label>
            <Input
              id={`${uid}-date`}
              type="date"
              required
              value={times.date}
              onChange={(e) => setTimes({ ...times, date: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`${uid}-start`}>Inicio</Label>
            <Input
              id={`${uid}-start`}
              type="time"
              required
              value={times.start}
              onChange={(e) => setTimes({ ...times, start: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`${uid}-end`}>Fin</Label>
            <Input
              id={`${uid}-end`}
              type="time"
              required
              value={times.end}
              onChange={(e) => setTimes({ ...times, end: e.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between gap-3 md:justify-end">
          <p className="text-sm text-muted-foreground">
            {range ? (
              <>
                <span className="font-medium text-foreground">{formatDuration(range.seconds)}</span>
                {range.overnight && " Â· termina al dÃ­a siguiente"}
              </>
            ) : (
              "DuraciÃ³n: â€”"
            )}
          </p>
          <div className="flex gap-2">
            {isDialog && (
              <Button variant="secondary" onClick={onDone} disabled={pending}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={pending} className="min-w-28">
              {pending && <Loader2 className="size-4 animate-spin" />}
              {entry ? "Guardar" : "AÃ±adir"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
