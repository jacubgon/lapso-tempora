import { brand } from "@/config/brand";
import { Card } from "@/components/ui";
import { getSession } from "@/lib/session";
import { NewPasswordForm } from "./new-password-form";

export const metadata = { title: "Nueva contraseña" };

export default async function RestablecerPage() {
  // Llega aquí con la sesión que crea el enlace del email
  const { profile } = await getSession();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            {brand.initial}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p>
        </div>
        <Card className="p-6">
          <NewPasswordForm />
        </Card>
      </div>
    </main>
  );
}
