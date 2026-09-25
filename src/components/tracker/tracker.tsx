"use client";

import { useState } from "react";
import { isThisWeek, isToday } from "date-fns";
import { Clock, PenLine } from "lucide-react";
import { Card } from "@/components/ui";
import { useIsClient } from "@/lib/hooks";
import { cn, entrySeconds, formatDuration } from "@/lib/utils";
import type { Project, Task, TimeEntry } from "@/lib/types";
import { TimerPanel } from "./timer-panel";
import { ManualForm } from "./manual-form";
import { EntryHistory } from "./entry-history";

type Mode = "timer" | "manual";
const MODE_KEY = "lapso:mode";

type Props = {
  running: TimeEntry | null;
  entries: TimeEntry[];
  projects: Project[];
  tasks: Task[];
  weeks: number;
  lockBefore: string | null;
  canBypassLock: boolean;
};

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "manual" ? "manual" : "timer";
  } catch {
    return "timer";
  }
}

export function Tracker(props: Props) {
  // Todo lo de fechas depende de la zona horaria del navegador: render solo en cliente.
  const isClient = useIsClient();
  if (!isClient) return <TrackerSkeleton />;
  return <TrackerInner {...props} />;
}

function TrackerInner({ running, entries, projects, tasks, weeks, lockBefore, canBypassLock }: Props) {
  const [preferred, setMode] = useState<Mode>(readMode);
  // Con un cronómetro en marcha siempre se muestra el cronómetro.
  const mode: Mode = running ? "timer" : preferred;
  const activeProjects = projects.filter((p) => !p.archived);

  function changeMode(m: Mode) {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  }

  const today = entries.filter((e) => isToday(new Date(e.started_at))).reduce((s, e) => s + entrySeconds(e), 0);
  const week = entries
    .filter((e) => isThisWeek(new Date(e.started_at), { weekStartsOn: 1 }))
    .reduce((s, e) => s + entrySeconds(e), 0);

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Modo de registro" className="inline-flex rounded-lg border border-border bg-card p-1">
            {(
              [
                { id: "timer", label: "CronÃ³metro", icon: Clock },
                { id: "manual", label: "Manual", icon: PenLine },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                onClick={() => changeMode(id)}
                disabled={!!running && id === "manual"}
                title={running && id === "manual" ? "Para el cronÃ³metro para registrar a mano" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-40",
                  mode === id ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
          <div className="flex gap-5 text-sm text-muted-foreground">
            <span>
              Hoy <strong className="tabular-nums text-foreground">{formatDuration(today)}</strong>
            </span>
            <span>
              Semana <strong className="tabular-nums text-foreground">{formatDuration(week)}</strong>
            </span>
          </div>
        </div>

        <Card className={cn("p-4", running && "ring-2 ring-primary/40")}>
          {activeProjects.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              TodavÃ­a no tienes proyectos asignados. Pide a producciÃ³n que te aÃ±ada a alguno.
            </p>
          ) : mode === "timer" ? (
            <TimerPanel key={running?.id ?? "idle"} running={running} projects={projects} tasks={tasks} />
          ) : (
            <ManualForm projects={projects} tasks={tasks} />
          )}
        </Card>
      </div>

      <EntryHistory
        entries={entries}
        projects={projects}
        tasks={tasks}
        weeks={weeks}
        lockBefore={lockBefore}
        canBypassLock={canBypassLock}
      />
    </div>
  );
}

function TrackerSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-busy>
      <div className="space-y-3">
        <div className="h-10 w-56 rounded-lg bg-muted" />
        <div className="h-[74px] rounded-xl bg-muted" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="h-40 rounded-xl bg-muted" />
      ))}
    </div>
  );
}
