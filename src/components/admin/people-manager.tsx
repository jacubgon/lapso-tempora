"use client";

import { useMemo, useState, useTransition } from "react";
import { Copy, KeyRound, Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Dialog, Input, Label, Select } from "@/components/ui";
import { createPerson, resetPassword, updatePerson } from "@/app/(app)/produccion/gestion/actions";
import { Badge, Checklist, Toggle, type Dept, type Membership, type Person, type ProjectRow } from "./shared";

type Props = {
  people: Person[];
  departments: Dept[];
  projects: ProjectRow[];
  memberships: Membership[];
  currentUserId: string;
};

/** Contraseña temporal legible: sin caracteres ambiguos (0/O, 1/l). */
function tempPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function PeopleManager({ people, departments, projects, memberships, currentUserId }: Props) {
  const [editing, setEditing] = useState<Person | "new" | null>(null);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));

  const projectsOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const x of memberships) m.set(x.user_id, [...(m.get(x.user_id) ?? []), x.project_id]);
    return m;
  }, [memberships]);

  const inactive = people.filter((p) => !p.active).length;
  const shown = people.filter(
    (p) =>
      (showInactive || p.active) &&
      `${p.full_name} ${p.email}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <Input placeholder="Buscar persona…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          {inactive > 0 && (
            <Toggle checked={showInactive} onChange={setShowInactive} label={`Mostrar desactivadas (${inactive})`} />
          )}
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Nueva persona
        </Button>
      </div>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {shown.map((p) => {
            const n = projectsOf.get(p.id)?.length ?? 0;
            return (
              <li key={p.id}>
                <button
                  onClick={() => setEditing(p)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                    {(p.full_name || p.email).charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{p.full_name || p.email}</span>
                      {p.role === "admin" && <Badge tone="primary">Producción</Badge>}
                      {!p.active && <Badge tone="danger">Desactivada</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  <p className="hidden w-36 truncate text-sm text-muted-foreground md:block">
                    {p.department_id ? deptName.get(p.department_id) : "—"}
                  </p>
                  <p className="w-24 text-right text-sm text-muted-foreground">
                    {n} proyecto{n === 1 ? "" : "s"}
                  </p>
                  <Pencil className="size-4 text-muted-foreground" />
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-6 py-10 text-center text-sm text-muted-foreground">Sin resultados</li>}
        </ul>
      </Card>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nueva persona" : "Editar persona"}
        className="max-w-xl"
      >
        {editing && (
          <PersonForm
            key={editing === "new" ? "new" : editing.id}
            person={editing === "new" ? null : editing}
            projectIds={editing === "new" ? [] : (projectsOf.get(editing.id) ?? [])}
            departments={departments}
            projects={projects}
            isSelf={editing !== "new" && editing.id === currentUserId}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

function PersonForm({
  person,
  projectIds: initialProjects,
  departments,
  projects,
  isSelf,
  onDone,
}: {
  person: Person | null;
  projectIds: string[];
  departments: Dept[];
  projects: ProjectRow[];
  isSelf: boolean;
  onDone: () => void;
}) {
  const [fullName, setFullName] = useState(person?.full_name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [password, setPassword] = useState(() => (person ? "" : tempPassword()));
  const [departmentId, setDepartmentId] = useState(person?.department_id ?? "");
  const [role, setRole] = useState<"user" | "admin">(person?.role ?? "user");
  const [active, setActive] = useState(person?.active ?? true);
  const [projectIds, setProjectIds] = useState(initialProjects);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copiado"),
      () => toast.error("No se pudo copiar"),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const base = { full_name: fullName, department_id: departmentId || null, role, projectIds };
    startTransition(async () => {
      const r = person
        ? await updatePerson(person.id, { ...base, active })
        : await createPerson({ ...base, email, password });
      if (!r.ok) return void toast.error(r.error);
      toast.success(person ? "Cambios guardados" : `Cuenta creada para ${fullName}`, {
        description: person ? undefined : "Recuerda enviarle su email y contraseña temporal.",
      });
      onDone();
    });
  }

  function onReset() {
    const pwd = tempPassword();
    startTransition(async () => {
      const r = await resetPassword(person!.id, pwd);
      if (!r.ok) return void toast.error(r.error);
      setNewPassword(pwd);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="u-name">Nombre y apellidos</Label>
          <Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
        </div>
        <div>
          <Label htmlFor="u-email">Email</Label>
          <Input
            id="u-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={!!person}
          />
        </div>
      </div>

      {!person && (
        <div>
          <Label htmlFor="u-pass">Contraseña temporal</Label>
          <div className="flex gap-2">
            <Input
              id="u-pass"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              className="font-mono"
            />
            <Button variant="secondary" size="icon" onClick={() => setPassword(tempPassword())} aria-label="Generar otra">
              <RefreshCw className="size-4" />
            </Button>
            <Button variant="secondary" size="icon" onClick={() => copy(password)} aria-label="Copiar">
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Cópiala ahora: después no se puede volver a ver.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="u-dept">Departamento</Label>
          <Select id="u-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Sin departamento</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="u-role">Rol</Label>
          <Select
            id="u-role"
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "admin")}
            disabled={isSelf}
          >
            <option value="user">Usuario (registra sus horas)</option>
            <option value="admin">Producción (ve y gestiona todo)</option>
          </Select>
        </div>
      </div>

      <div>
        <Label>Proyectos asignados</Label>
        <Checklist
          items={projects
            .filter((p) => !p.archived || projectIds.includes(p.id))
            .map((p) => ({ id: p.id, label: p.name, hint: p.client ?? undefined, color: p.color }))}
          selected={projectIds}
          onChange={setProjectIds}
          empty="No hay proyectos. Créalos en la pestaña Proyectos."
        />
      </div>

      {person && !isSelf && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-3 well">
          <Toggle checked={active} onChange={setActive} label={active ? "Cuenta activa" : "Cuenta desactivada (no puede entrar)"} />
          <Button variant="secondary" size="sm" onClick={onReset} disabled={pending}>
            <KeyRound className="size-4" /> Nueva contraseña
          </Button>
          {newPassword && (
            <div className="flex w-full items-center gap-2 rounded-md bg-primary-soft px-3 py-2 text-sm">
              <span>Nueva contraseña:</span>
              <code className="font-mono font-semibold">{newPassword}</code>
              <Button variant="ghost" size="icon" onClick={() => copy(newPassword)} aria-label="Copiar" className="ml-auto">
                <Copy className="size-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {person ? "Guardar" : "Crear cuenta"}
        </Button>
      </div>
    </form>
  );
}
