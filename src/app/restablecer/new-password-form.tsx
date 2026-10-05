"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { NewPasswordFields, passwordsValid } from "@/components/account/password-fields";
import { setNewPassword } from "@/app/login/actions";

export function NewPasswordForm() {
  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!passwordsValid(value, confirm)) return;
        startTransition(async () => {
          const r = await setNewPassword(value);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Contraseña guardada");
          router.replace("/");
        });
      }}
    >
      <NewPasswordFields value={value} confirm={confirm} onChange={setValue} onConfirmChange={setConfirm} />
      <Button type="submit" className="w-full" disabled={pending || !passwordsValid(value, confirm)}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Guardar y entrar
      </Button>
    </form>
  );
}
