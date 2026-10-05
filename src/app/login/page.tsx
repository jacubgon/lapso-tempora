import { brand } from "@/config/brand";
import { Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            {brand.initial}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{brand.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{brand.tagline}</p>
        </div>
        {error === "enlace" && (
          <p role="alert" className="mb-4 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">
            El enlace ha caducado o ya se usó. Pide uno nuevo desde «¿La has olvidado?».
          </p>
        )}
        <Card className="p-6">
          <LoginForm />
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿No tienes acceso? Pídeselo a tu responsable.
        </p>
      </div>
    </main>
  );
}
