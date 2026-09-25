"use client";

import { useId, useMemo } from "react";
import { Input, Label, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Project, Task } from "@/lib/types";

export type FieldsValue = { title: string; projectId: string | null; taskName: string };

export const emptyFields: FieldsValue = { title: "", projectId: null, taskName: "" };

export function fieldsFromEntry(
  e: { title: string; project_id: string | null; task_id: string | null },
  tasks: Task[],
): FieldsValue {
  return {
    title: e.title,
    projectId: e.project_id,
    taskName: tasks.find((t) => t.id === e.task_id)?.name ?? "",
  };
}

type Props = {
  value: FieldsValue;
  onChange: (v: FieldsValue) => void;
  /** Se llama al salir de un campo de texto o al cambiar de proyecto. */
  onCommit?: (v: FieldsValue) => void;
  projects: Project[];
  tasks: Task[];
  layout?: "inline" | "stacked";
  disabled?: boolean;
};

export function EntryFields({ value, onChange, onCommit, projects, tasks, layout = "stacked", disabled }: Props) {
  const uid = useId();
  const listId = `${uid}-tasks`;
  const inline = layout === "inline";

  const selectable = useMemo(
    () => projects.filter((p) => !p.archived || p.id === value.projectId),
    [projects, value.projectId],
  );
  const project = projects.find((p) => p.id === value.projectId);
  const projectTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.project_id === value.projectId)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [tasks, value.projectId],
  );

  return (
    <div className={cn("grid gap-3", inline ? "md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]" : "")}>
      <div>
        <Label htmlFor={`${uid}-title`} className={cn(inline && "sr-only")}>
          ¿En qué trabajas?
        </Label>
        <Input
          id={`${uid}-title`}
          placeholder="¿En qué estás trabajando?"
          value={value.title}
          maxLength={300}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          onBlur={() => onCommit?.(value)}
        />
      </div>

      <div>
        <Label htmlFor={`${uid}-project`} className={cn(inline && "sr-only")}>
          Proyecto
        </Label>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-2.5 -translate-y-1/2 rounded-full"
            style={{ background: project?.color ?? "var(--border)" }}
          />
          <Select
            id={`${uid}-project`}
            className="pl-8"
            value={value.projectId ?? ""}
            disabled={disabled}
            onChange={(e) => {
              const projectId = e.target.value || null;
              // Cambiar de proyecto invalida la subtarea
              const next = { ...value, projectId, taskName: "" };
              onChange(next);
              onCommit?.(next);
            }}
          >
            <option value="">Proyecto…</option>
            {selectable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.client ? ` · ${p.client}` : ""}
                {p.archived ? " (archivado)" : ""}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor={`${uid}-task`} className={cn(inline && "sr-only")}>
          Subtarea <span className="font-normal">(opcional)</span>
        </Label>
        <Input
          id={`${uid}-task`}
          list={listId}
          placeholder={value.projectId ? "Subtarea (escribe o elige)" : "Elige antes un proyecto"}
          value={value.taskName}
          maxLength={120}
          disabled={disabled || !value.projectId}
          autoComplete="off"
          onChange={(e) => onChange({ ...value, taskName: e.target.value })}
          onBlur={() => onCommit?.(value)}
        />
        <datalist id={listId}>
          {projectTasks.map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
