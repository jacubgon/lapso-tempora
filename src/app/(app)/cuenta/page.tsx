import { getSession } from "@/lib/session";
import { NameForm, PasswordForm } from "@/components/account/account-forms";

export const metadata = { title: "Mi cuenta" };

export default async function CuentaPage() {
  const { profile } = await getSession();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">Tus datos de acceso.</p>
      </div>
      <NameForm initial={profile.full_name} email={profile.email} />
      <PasswordForm />
    </div>
  );
}
