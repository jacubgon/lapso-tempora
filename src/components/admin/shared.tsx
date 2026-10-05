"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type Person = {
  id: string;
  full_name: string;
  email: string;
  department_id: string | null;
  role: "user" | "admin";
  active: boolean;
};
export type Dept = { id: string; name: string };
export type ProjectRow = {
  id: string;
  name: string;
  client: string | null;
  color: string;
  archived: boolean;
};
export type TaskRow = { id: string; project_id: string; name: string };
export type Membership = { project_id: string; user_id: string };

// Paleta validada (misma que los informes)
export const PROJECT_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

/** Lista de casillas con buscador y "seleccionar todo". */
export function Checklist({
  items,
  selected,
  onChange,
  empty = "No hay elementos",
}: {
  items: { id: string; label: string; hint?: string; color?: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  empty?: string;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(
    () => items.filter((i) => `${i.label} ${i.hint ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    [items, q],
  );
  const sel = new Set(selected);
  const allShown = shown.length > 0 && shown.every((i) => sel.has(i.id));

  function toggle(id: string) {
    onChange(sel.has(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <div className="rounded-xl bg-background neu-inset-sm">
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
          className="h-9 flex-1 bg-transparent text-sm outline-none"
        />
        {shown.length > 0 && (
          <button
            type="button"
            className="text-xs font-medium text-primary"
            onClick={() =>
              onChange(
                allShown
                  ? selected.filter((s) => !shown.some((i) => i.id === s))
                  : [...new Set([...selected, ...shown.map((i) => i.id)])],
              )
            }
          >
            {allShown ? "Quitar todos" : "Marcar todos"}
          </button>
        )}
      </div>
      <ul className="max-h-52 overflow-y-auto p-1">
        {shown.length === 0 && <li className="px-2 py-3 text-center text-sm text-muted-foreground">{empty}</li>}
        {shown.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => toggle(i.id)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border",
                  sel.has(i.id) ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {sel.has(i.id) && <Check className="size-3" strokeWidth={3} />}
              </span>
              {i.color && <span className="size-2.5 shrink-0 rounded-sm" style={{ background: i.color }} />}
              <span className="min-w-0 flex-1 truncate">{i.label}</span>
              {i.hint && <span className="truncate text-xs text-muted-foreground">{i.hint}</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        {selected.length} seleccionado{selected.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 rounded-full transition neu-inset-sm",
          checked ? "bg-primary" : "bg-background",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-card neu-raised-sm transition-all",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
      {label}
    </label>
  );
}

export function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "primary" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "primary" && "bg-primary-soft text-primary",
        tone === "danger" && "bg-destructive-soft text-destructive",
      )}
    >
      {children}
    </span>
  );
}
