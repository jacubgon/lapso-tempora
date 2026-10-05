"use client";

import { useState, useTransition } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, Label } from "@/components/ui";
import { saveSettings } from "@/app/(app)/produccion/gestion/actions";

type Settings = { lockBefore: string | null; cycleAnchor: string | null; cycleDays: number };

const nice = (d: string) => format(parseISO(d), "EEEE d 'de' MMMM yyyy", { locale: es });

/** Inicio del ciclo que contiene `today`. */
function currentCycleStart(anchor: string, days: number, today = new Date()) {
  const a = parseISO(anchor);
  const idx = Math.floor(differenceInCalendarDays(today, a) / days);
  return addDays(a, idx * days);
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const [lockBefore, setLockBefore] = useState(settings.lockBefore ?? "");
  const [cycleAnchor, setCycleAnchor] = useState(settings.cycleAnchor ?? "");
  const [cycleDays, setCycleDays] = useState(settings.cycleDays);
  const [pending, startTransition] = useTransition();

  function save(overrides: Partial<{ lock_before: string | null }> = {}) {
    startTransition(async () => {
      const r = await saveSettings({
        lock_before: lockBefore || null,
        cycle_anchor: cycleAnchor || null,
        cycle_days: cycleDays,
        ...overrides,
      });
      if (r.ok) toast.success("Ajustes guardados");
      else toast.error(r.error);
    });
  }

  const cycleStart = cycleAnchor && cycleDays > 0 ? currentCycleStart(cycleAnchor, cycleDays) : null;

  return (
    <div className="grid max-w-3xl gap-4">
      <Card className="p-5">
        <h2 className="font-semibold">Ciclo de reuniones</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Indica la fecha de cualquier reunión general y cada cuántos días se repite. En los informes aparecerá el
          periodo «Ciclo de reunión», que va de una reunión a la siguiente.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem]">
          <div>
            <Label htmlFor="s-anchor">Fecha de una reunión general</Label>
            <Input id="s-anchor" type="date" value={cycleAnchor} onChange={(e) => setCycleAnchor(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="s-days">Cada (días)</Label>
            <Input
              id="s-days"
              type="number"
              min={1}
              max={90}
              value={cycleDays}
              onChange={(e) => setCycleDays(Number(e.target.value) || 14)}
            />
          </div>
        </div>
        {cycleStart && (
          <p className="mt-3 text-sm text-muted-foreground">
            Ciclo actual: del <strong className="text-foreground">{format(cycleStart, "d MMM", { locale: es })}</strong> al{" "}
            <strong className="text-foreground">
              {format(addDays(cycleStart, cycleDays - 1), "d MMM yyyy", { locale: es })}
            </strong>
            . Próxima reunión: {format(addDays(cycleStart, cycleDays), "EEEE d 'de' MMMM", { locale: es })}.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          {settings.lockBefore ? <Lock className="size-4" /> : <Unlock className="size-4" />} Cierre de periodos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Las entradas anteriores a esta fecha quedan bloqueadas: el equipo ya no puede crearlas, editarlas ni
          borrarlas. Producción sí puede corregirlas. Todos los cambios quedan registrados.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="s-lock">Bloquear entradas anteriores al</Label>
            <Input
              id="s-lock"
              type="date"
              value={lockBefore}
              onChange={(e) => setLockBefore(e.target.value)}
              className="w-48"
            />
          </div>
          {cycleStart && (
            <Button variant="secondary" onClick={() => setLockBefore(format(cycleStart, "yyyy-MM-dd"))}>
              Cerrar hasta el ciclo actual
            </Button>
          )}
          {lockBefore && (
            <Button variant="ghost" onClick={() => setLockBefore("")}>
              Quitar bloqueo
            </Button>
          )}
        </div>
        <p className="mt-3 text-sm">
          {settings.lockBefore ? (
            <>
              Ahora mismo está cerrado todo lo anterior al <strong>{nice(settings.lockBefore)}</strong>.
            </>
          ) : (
            <span className="text-muted-foreground">Ahora mismo no hay ningún periodo cerrado.</span>
          )}
        </p>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save()} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Guardar ajustes
        </Button>
      </div>
    </div>
  );
}
