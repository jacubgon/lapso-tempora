"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input } from "@/components/ui";
import { deleteDepartment, saveDepartment } from "@/app/(app)/produccion/gestion/actions";
import type { Dept, Person } from "./shared";

export function DepartmentsManager({ departments, people }: { departments: Dept[]; people: Person[] }) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const count = (id: string) => people.filter((p) => p.department_id === id && p.active).length;

  function add(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await saveDepartment(null, name);
      if (!r.ok) return void toast.error(r.error);
      setName("");
    });
  }

  function rename(id: string) {
    startTransition(async () => {
      const r = await saveDepartment(id, draft);
      if (!r.ok) return void toast.error(r.error);
      setEditingId(null);
    });
  }

  function remove(d: Dept) {
    const n = count(d.id);
    if (!confirm(`¿Borrar «${d.name}»?${n ? ` ${n} persona(s) quedarán sin departamento.` : ""}`)) return;
    startTransition(async () => {
      const r = await deleteDepartment(d.id);
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Opcional. Si los usas, podrás filtrar los informes por departamento. Cada persona pertenece a uno.
      </p>
      <form onSubmit={add} className="flex gap-2">
        <Input placeholder="Nuevo departamento" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Button type="submit" disabled={pending || !name.trim()}>
          <Plus className="size-4" /> Añadir
        </Button>
      </form>
      {departments.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {departments.map((d) => (
              <li key={d.id} className="flex items-center gap-2 px-4 py-2">
                {editingId === d.id ? (
                  <>
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      autoFocus
                      className="h-9"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") rename(d.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button size="icon" variant="ghost" onClick={() => rename(d.id)} disabled={pending} aria-label="Guardar">
                      <Check className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancelar">
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{d.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {count(d.id)} persona{count(d.id) === 1 ? "" : "s"}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Renombrar"
                      onClick={() => {
                        setEditingId(d.id);
                        setDraft(d.name);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Borrar" onClick={() => remove(d)} disabled={pending}>
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
