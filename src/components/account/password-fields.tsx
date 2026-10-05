"use client";

import { useId } from "react";
import { Input, Label } from "@/components/ui";

/** Nueva contraseña + repetirla, con validación visible. */
export function NewPasswordFields({
  value,
  confirm,
  onChange,
  onConfirmChange,
}: {
  value: string;
  confirm: string;
  onChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
}) {
  const uid = useId();
  const tooShort = value.length > 0 && value.length < 8;
  const mismatch = confirm.length > 0 && confirm !== value;
  return (
    <>
      <div>
        <Label htmlFor={`${uid}-new`}>Nueva contraseña</Label>
        <Input
          id={`${uid}-new`}
          type="password"
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minLength={8}
          required
        />
        <p className={`mt-1 text-xs ${tooShort ? "text-destructive" : "text-muted-foreground"}`}>Mínimo 8 caracteres.</p>
      </div>
      <div>
        <Label htmlFor={`${uid}-confirm`}>Repite la nueva contraseña</Label>
        <Input
          id={`${uid}-confirm`}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => onConfirmChange(e.target.value)}
          required
        />
        {mismatch && <p className="mt-1 text-xs text-destructive">No coincide.</p>}
      </div>
    </>
  );
}

export const passwordsValid = (value: string, confirm: string) => value.length >= 8 && value === confirm;
