"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Dialog, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";
import { deleteProject, deleteTask, renameTask, saveProject } from "@/app/(app)/produccion/gestion/actions";
import {
  Badge,
  Checklist,
  PROJECT_COLORS,
  Toggle,
  type Dept,
  type Membership,
  type Person,
  type ProjectRow,
  type TaskRow,
} from "./shared";

type Props = {
  projects: ProjectRow[];
  people: Person[];
  departments: Dept[];
  tasks: TaskRow[];
  memberships: Membership[];
};

export function ProjectsManager({ projects, people, departments, tasks, memberships }: Props) {
  const [editing, setEditing] = useState<ProjectRow | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const membersOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const x of memberships) m.set(x.project_id, [...(m.get(x.project_id) ?? []), x.user_id]);
    return m;
  }, [memberships]);

  const shown = projects.filter((p) => showArchived || !p.archived);
  const archivedCount = projects.filter((p) => p.archived).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {archivedCount > 0 ? (
          <Toggle checked={showArchived} onChange={setShowArchived} label={`Mostrar archivados (${archivedCount})`} />
        ) : (
          <span />
        )}
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Nuevo proyecto
        </Button>
      </div>

      <Card className="overflow-hidden">
        {shown.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            Aún no hay proyectos. Crea el primero y asígnaselo a las personas que trabajarán en él.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((p) => {
              const members = membersOf.get(p.id) ?? [];
              const taskCount = tasks.filter((t) => t.project_id === p.id).length;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setEditing(p)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/50"
                  >
                    <span className="size-3 shrink-0 rounded" style={{ background: p.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate font-medium">
                        {p.name} {p.archived && <Badge>Archivado</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{p.client || "Sin cliente"}</p>
                    </div>
                    <p className="hidden text-sm text-muted-foreground sm:block">
                      {taskCount} subtarea{taskCount === 1 ? "" : "s"}
                    </p>
                    <p className="w-28 text-right text-sm text-muted-foreground">
                      {members.length} persona{members.length === 1 ? "" : "s"}
                    </p>
                    <Pencil className="size-4 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nuevo proyecto" : "Editar proyecto"}
        className="max-w-xl"
      >
        {editing && (
          <ProjectForm
            key={editing === "new" ? "new" : editing.id}
            project={editing === "new" ? null : editing}
            members={editing === "new" ? [] : (membersOf.get(editing.id) ?? [])}
            people={people}
            departments={departments}
            tasks={editing === "new" ? [] : tasks.filter((t) => t.project_id === editing.id)}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

function ProjectForm({
  project,
  members,
  people,
  departments,
  tasks,
  onDone,
}: {
  project: ProjectRow | null;
  members: string[];
  people: Person[];
  departments: Dept[];
  tasks: TaskRow[];
  onDone: () => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [client, setClient] = useState(project?.client ?? "");
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  const [archived, setArchived] = useState(project?.archived ?? false);
  const [memberIds, setMemberIds] = useState(members);
  const [pending, startTransition] = useTransition();
  const deptName = new Map(departments.map((d) => [d.id, d.name]));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await saveProject(project?.id ?? null, { name, client, color, archived, memberIds });
      if (!r.ok) return void toast.error(r.error);
      toast.success(project ? "Proyecto guardado" : "Proyecto creado");
      onDone();
    });
  }

  function onDelete() {
    if (!project || !confirm(`¿Borrar el proyecto «${project.name}»?`)) return;
    startTransition(async () => {
      const r = await deleteProject(project.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Proyecto borrado");
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="p-name">Nombre</Label>
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoFocus />
        </div>
        <div>
          <Label htmlFor="p-client">Cliente (opcional)</Label>
          <Input id="p-client" value={client} onChange={(e) => setClient(e.target.value)} maxLength={120} />
        </div>
      </div>

      <div>
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cn(
                "flex size-8 items-center justify-center rounded-lg transition",
                color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
              )}
              style={{ background: c }}
            >
              {color === c && <Check className="size-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Personas asignadas</Label>
        <Checklist
          items={people
            .filter((p) => p.active || memberIds.includes(p.id))
            .map((p) => ({
              id: p.id,
              label: p.full_name || p.email,
              hint: p.department_id ? deptName.get(p.department_id) : undefined,
            }))}
          selected={memberIds}
          onChange={setMemberIds}
          empty="No hay personas. Créalas en la pestaña Personas."
        />
      </div>

      {project && tasks.length > 0 && <TaskList tasks={tasks} />}

      {project && <Toggle checked={archived} onChange={setArchived} label="Archivado (no admite horas nuevas)" />}

      <div className="flex items-center justify-between gap-2 pt-2">
        {project ? (
          <Button variant="ghost" onClick={onDelete} disabled={pending} className="text-destructive">
            <Trash2 className="size-4" /> Borrar
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDone} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Subtareas creadas por el equipo: producción puede renombrarlas o borrarlas. */
function TaskList({ tasks }: { tasks: TaskRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const sorted = [...tasks].sort((a, b) => a.name.localeCompare(b.name, "es"));

  function save(id: string) {
    startTransition(async () => {
      const r = await renameTask(id, draft);
      if (!r.ok) return void toast.error(r.error);
      setEditingId(null);
    });
  }

  function remove(t: TaskRow) {
    if (!confirm(`¿Borrar la subtarea «${t.name}»? Sus entradas quedarán sin subtarea.`)) return;
    startTransition(async () => {
      const r = await deleteTask(t.id);
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <div>
      <Label>Subtareas creadas por el equipo</Label>
      <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {sorted.map((t) => (
          <li key={t.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
            {editingId === t.id ? (
              <>
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      save(t.id);
                    }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Button size="icon" variant="ghost" onClick={() => save(t.id)} disabled={pending} aria-label="Guardar">
                  <Check className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancelar">
                  <X className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 truncate">{t.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Renombrar"
                  onClick={() => {
                    setEditingId(t.id);
                    setDraft(t.name);
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Borrar" onClick={() => remove(t)} disabled={pending}>
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
