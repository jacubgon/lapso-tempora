"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { History, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog } from "@/components/ui";
import { ManualForm } from "@/components/tracker/manual-form";
import { formatDuration } from "@/lib/utils";
import type { Project, Task, TimeEntry } from "@/lib/types";
import { deleteEntry } from "@/app/(app)/actions";
import { getEntryAudit, type AuditRow } from "@/app/(app)/produccion/gestion/actions";

type Lookup = {
  projects: Project[];
  tasks: Task[];
  people: { id: string; full_name: string; email: string }[];
};

type Ctx = {
  edit: (e: TimeEntry, who: string) => void;
  remove: (e: TimeEntry, who: string) => void;
  history: (e: TimeEntry, who: string) => void;
};

const EditorContext = createContext<Ctx | null>(null);

/** Un único juego de diálogos para toda la tabla (las filas solo llevan los botones). */
export function EntryEditorProvider({ lookup, children }: { lookup: Lookup; children: React.ReactNode }) {
  const [editing, setEditing] = useState<{ entry: TimeEntry; who: string } | null>(null);
  const [deleting, setDeleting] = useState<{ entry: TimeEntry; who: string } | null>(null);
  const [auditing, setAuditing] = useState<{ entry: TimeEntry; who: string; rows: AuditRow[] | null } | null>(null);
  const [pending, startTransition] = useTransition();

  const ctx: Ctx = {
    edit: (entry, who) => setEditing({ entry, who }),
    remove: (entry, who) => setDeleting({ entry, who }),
    history: (entry, who) => {
      setAuditing({ entry, who, rows: null });
      startTransition(async () => {
        const r = await getEntryAudit(entry.id);
        if (!r.ok) {
          toast.error(r.error);
          setAuditing(null);
        } else setAuditing({ entry, who, rows: r.rows });
      });
    },
  };

  function confirmDelete() {
    if (!deleting) return;
    const id = deleting.entry.id;
    startTransition(async () => {
      const r = await deleteEntry(id);
      if (r.ok) toast.success("Entrada eliminada");
      else toast.error(r.error);
      setDeleting(null);
    });
  }

  return (
    <EditorContext.Provider value={ctx}>
      {children}

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={`Editar entrada · ${editing?.who ?? ""}`}>
        {editing && (
          <ManualForm
            key={editing.entry.id}
            entry={editing.entry}
            projects={lookup.projects}
            tasks={lookup.tasks}
            layout="dialog"
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="¿Eliminar entrada?">
        {deleting && (
          <>
            <p className="text-sm text-muted-foreground">
              «{deleting.entry.title}» de <strong className="text-foreground">{deleting.who}</strong>,{" "}
              {format(new Date(deleting.entry.started_at), "d MMM yyyy HH:mm", { locale: es })}. Quedará constancia en el
              historial de cambios.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleting(null)} disabled={pending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmDelete} disabled={pending}>
                Eliminar
              </Button>
            </div>
          </>
        )}
      </Dialog>

      <Dialog open={!!auditing} onClose={() => setAuditing(null)} title="Historial de cambios">
        {auditing &&
          (auditing.rows === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AuditList rows={auditing.rows} lookup={lookup} />
          ))}
      </Dialog>
    </EditorContext.Provider>
  );
}

export function EntryRowActions({ entry, who }: { entry: TimeEntry; who: string }) {
  const ctx = useContext(EditorContext);
  if (!ctx) return null;
  return (
    <div className="flex justify-end">
      <Button variant="ghost" size="icon" title="Editar" onClick={() => ctx.edit(entry, who)}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" title="Historial de cambios" onClick={() => ctx.history(entry, who)}>
        <History className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" title="Eliminar" onClick={() => ctx.remove(entry, who)}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

// --- Historial ----------------------------------------------------------------------

const FIELDS: Record<string, string> = {
  title: "Título",
  project_id: "Proyecto",
  task_id: "Subtarea",
  started_at: "Inicio",
  ended_at: "Fin",
};

function AuditList({ rows, lookup }: { rows: AuditRow[]; lookup: Lookup }) {
  const person = (id: string | null) => {
    if (!id) return "Sistema";
    const p = lookup.people.find((x) => x.id === id);
    return p?.full_name || p?.email || "Desconocido";
  };
  const show = (field: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (field === "project_id") return lookup.projects.find((p) => p.id === v)?.name ?? "—";
    if (field === "task_id") return lookup.tasks.find((t) => t.id === v)?.name ?? "—";
    if (field === "started_at" || field === "ended_at")
      return format(new Date(String(v)), "d MMM yyyy HH:mm", { locale: es });
    return String(v);
  };

  if (rows.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">Sin cambios registrados.</p>;

  return (
    <ol className="max-h-[60vh] space-y-3 overflow-y-auto">
      {rows.map((r, i) => {
        const changes =
          r.action === "update"
            ? Object.keys(FIELDS).filter(
                (f) => JSON.stringify(r.old_data?.[f]) !== JSON.stringify(r.new_data?.[f]),
              )
            : [];
        if (r.action === "update" && changes.length === 0) return null;
        const data = r.new_data ?? r.old_data;
        const secs =
          data?.ended_at && data?.started_at
            ? (new Date(String(data.ended_at)).getTime() - new Date(String(data.started_at)).getTime()) / 1000
            : null;
        return (
          <li key={i} className="rounded-xl bg-background p-3 text-sm neu-inset-sm">
            <p className="flex flex-wrap justify-between gap-2">
              <strong>
                {r.action === "insert" ? "Creada" : r.action === "delete" ? "Eliminada" : "Modificada"} por{" "}
                {person(r.changed_by)}
              </strong>
              <span className="text-xs text-muted-foreground">
                {format(new Date(r.changed_at), "d MMM yyyy HH:mm", { locale: es })}
              </span>
            </p>
            {r.action === "update" ? (
              <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                {changes.map((f) => (
                  <li key={f}>
                    {FIELDS[f]}: <span className="line-through">{show(f, r.old_data?.[f])}</span> →{" "}
                    <span className="text-foreground">{show(f, r.new_data?.[f])}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-muted-foreground">
                {show("title", data?.title)} · {show("project_id", data?.project_id)}
                {secs !== null && ` · ${formatDuration(secs)}`}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
