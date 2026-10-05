import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { brand } from "@/config/brand";
import { Card } from "@/components/ui";
import { ResetRequestForm } from "./reset-request-form";

export const metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            {brand.initial}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Recuperar contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">Te enviaremos un enlace para crear una nueva.</p>
        </div>
        <Card className="p-6">
          <ResetRequestForm />
        </Card>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Volver a entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
