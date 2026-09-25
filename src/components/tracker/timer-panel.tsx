"use client";

import { useEffect, useState, useTransition } from "react";
import { Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { brand } from "@/config/brand";
import { useNow } from "@/lib/hooks";
import { entrySeconds, formatClock } from "@/lib/utils";
import type { Project, Task, TimeEntry } from "@/lib/types";
import { discardTimer, startTimer, stopTimer, updateRunning } from "@/app/(app)/actions";
import { EntryFields, emptyFields, fieldsFromEntry, type FieldsValue } from "./entry-fields";

type Props = { running: TimeEntry | null; projects: Project[]; tasks: Task[] };

/** Montar con key={running?.id ?? "idle"} para reiniciar el estado al cambiar de entrada. */
export function TimerPanel({ running, projects, tasks }: Props) {
  const [fields, setFields] = useState<FieldsValue>(() =>
    running ? fieldsFromEntry(running, tasks) : emptyFields,
  );
  const [saved, setSaved] = useState(fields);
  const [pending, startTransition] = useTransition();
  const now = useNow(!!running);
  const elapsed = running ? formatClock(entrySeconds(running, now)) : "0:00:00";

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

  function onStop() {
    startTransition(async () => {
      const r = await stopTimer(running!.id, fields);
      if (r.ok) toast.success("Tiempo registrado");
      else toast.error(r.error);
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
    <form
      className="flex flex-col gap-3 md:flex-row md:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (running) onStop();
        else onStart();
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
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span
          className={`font-mono text-2xl font-semibold tabular-nums tracking-tight ${running ? "text-foreground" : "text-muted-foreground/60"}`}
          aria-live="off"
        >
          {elapsed}
        </span>
        <div className="flex items-center gap-1.5">
          {running && (
            <Button variant="ghost" size="icon" onClick={onDiscard} disabled={pending} title="Descartar">
              <Trash2 className="size-4" />
            </Button>
          )}
          {running ? (
            <Button type="submit" variant="danger" disabled={pending} className="w-28">
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
  );
}
