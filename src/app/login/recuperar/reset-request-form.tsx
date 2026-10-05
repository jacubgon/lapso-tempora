"use client";

import { useActionState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { requestPasswordReset, type ResetState } from "../actions";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(requestPasswordReset, {});

  if (state.sent) {
    return (
      <div className="text-center" role="status">
        <MailCheck className="mx-auto size-8 text-primary" />
        <p className="mt-3 font-medium">Revisa tu correo</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Si <strong>{state.email}</strong> tiene cuenta, recibirás un enlace en unos minutos. Mira también en spam.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">Email de tu cuenta</Label>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.email} required autoFocus />
      </div>
      {state.error && (
        <p role="alert" className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Enviar enlace
      </Button>
    </form>
  );
}
