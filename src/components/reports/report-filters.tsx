"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { PERIOD_OPTIONS, type Period } from "@/lib/period";
import { cn } from "@/lib/utils";

export type FilterLookup = {
  departments: { id: string; name: string }[];
  people: { id: string; full_name: string; email: string; department_id: string | null }[];
  projects: { id: string; name: string; client: string | null }[];
  tasks: { id: string; project_id: string; name: string }[];
  hasCycle: boolean;
};

type Props = {
  lookup: FilterLookup;
  period: Pick<Period, "kind" | "label" | "prevRef" | "nextRef" | "fromDay" | "toDay">;
  /** Qué filtros mostrar */
  show?: { department?: boolean; project?: boolean; task?: boolean };
};

export function ReportFilters({ lookup, period, show = { department: true, project: true, task: true } }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("pagina");
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const dep = params.get("dep") ?? "";
  const user = params.get("usuario") ?? "";
  const project = params.get("proyecto") ?? "";
  const task = params.get("tarea") ?? "";

  const people = dep ? lookup.people.filter((p) => p.department_id === dep) : lookup.people;
  const tasks = lookup.tasks.filter((t) => t.project_id === project);
  const hasFilters = !!(dep || user || project || task);

  return (
    <div className="space-y-3">
      {/* Periodo */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-lg border border-border bg-card p-1">
          {PERIOD_OPTIONS.filter((o) => o.id !== "cycle" || lookup.hasCycle).map((o) => (
            <button
              key={o.id}
              onClick={() => update({ p: o.id, d: null })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                period.kind === o.id ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {period.kind === "custom" ? (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="Desde"
              key={`from-${period.fromDay}`}
              className="w-40"
              defaultValue={period.fromDay ?? ""}
              onChange={(e) => e.target.value && update({ desde: e.target.value })}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="date"
              aria-label="Hasta"
              key={`to-${period.toDay}`}
              className="w-40"
              defaultValue={period.toDay ?? ""}
              onChange={(e) => e.target.value && update({ hasta: e.target.value })}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {period.kind !== "all" && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Periodo anterior"
                disabled={!period.prevRef}
                onClick={() => update({ d: period.prevRef })}
              >
                <ChevronLeft className="size-4" />
              </Button>
            )}
            <span className="min-w-44 text-center text-sm font-semibold">{period.label}</span>
            {period.kind !== "all" && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Periodo siguiente"
                disabled={!period.nextRef}
                onClick={() => update({ d: period.nextRef })}
              >
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        )}
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {show.department && lookup.departments.length > 0 && (
          <Select
            aria-label="Departamento"
            className="w-auto min-w-40"
            value={dep}
            onChange={(e) => update({ dep: e.target.value || null, usuario: null })}
          >
            <option value="">Todos los departamentos</option>
            {lookup.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        )}
        <Select
          aria-label="Persona"
          className="w-auto min-w-40"
          value={user}
          onChange={(e) => update({ usuario: e.target.value || null })}
        >
          <option value="">Todas las personas</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name || p.email}
            </option>
          ))}
        </Select>
        {show.project && (
          <Select
            aria-label="Proyecto"
            className="w-auto min-w-40"
            value={project}
            onChange={(e) => update({ proyecto: e.target.value || null, tarea: null })}
          >
            <option value="">Todos los proyectos</option>
            {lookup.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.client ? ` · ${p.client}` : ""}
              </option>
            ))}
          </Select>
        )}
        {show.task && project && (
          <Select
            aria-label="Subtarea"
            className="w-auto min-w-40"
            value={task}
            onChange={(e) => update({ tarea: e.target.value || null })}
          >
            <option value="">Todas las subtareas</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update({ dep: null, usuario: null, proyecto: null, tarea: null })}
          >
            <RotateCcw className="size-3.5" /> Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
