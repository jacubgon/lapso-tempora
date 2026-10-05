"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, Label } from "@/components/ui";
import { changeMyPassword, updateMyName } from "@/app/(app)/cuenta/actions";
import { NewPasswordFields, passwordsValid } from "./password-fields";

export function NameForm({ initial, email }: { initial: string; email: string }) {
  const [name, setName] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Tus datos</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await updateMyName(name);
            if (r.ok) toast.success("Nombre actualizado");
            else toast.error(r.error);
          });
        }}
      >
        <div>
          <Label htmlFor="acc-name">Nombre y apellidos</Label>
          <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </div>
        <div>
          <Label htmlFor="acc-email">Email</Label>
          <Input id="acc-email" value={email} disabled />
          <p className="mt-1 text-xs text-muted-foreground">Para cambiar el email, pídeselo a producción.</p>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || name.trim() === initial}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Cambiar contraseña</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Si entraste con una contraseña temporal, cámbiala aquí por una tuya.
      </p>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!passwordsValid(next, confirm)) return;
          startTransition(async () => {
            const r = await changeMyPassword(current, next);
            if (!r.ok) return void toast.error(r.error);
            toast.success("Contraseña cambiada");
            setCurrent("");
            setNext("");
            setConfirm("");
          });
        }}
      >
        <div>
          <Label htmlFor="acc-current">Contraseña actual</Label>
          <Input
            id="acc-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <NewPasswordFields value={next} confirm={confirm} onChange={setNext} onConfirmChange={setConfirm} />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !current || !passwordsValid(next, confirm)}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </Card>
  );
}
