import Link from "next/link";
import { LogOut } from "lucide-react";
import { brand } from "@/config/brand";
import { getSession } from "@/lib/session";
import { logout } from "@/app/login/actions";
import { Nav, type NavItem } from "@/components/shell/nav";

const userNav: NavItem[] = [{ href: "/", label: "Mis horas" }];
const adminNav: NavItem[] = [
  { href: "/produccion", label: "Informes" },
  { href: "/produccion/detalle", label: "Detalle" },
  { href: "/produccion/gestion", label: "Gestión" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getSession();
  const items = profile.role === "admin" ? [...userNav, ...adminNav] : userNav;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 sm:gap-7 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 py-3" aria-label={brand.name}>
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              {brand.initial}
            </span>
            <span className="hidden font-bold tracking-tight sm:inline">{brand.name}</span>
          </Link>
          <div className="flex min-w-0 flex-1 self-stretch">
            <Nav items={items} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/cuenta"
              title="Mi cuenta"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-muted"
            >
              <span className="hidden text-right leading-tight md:block">
                <span className="block text-sm font-medium">{profile.full_name || profile.email}</span>
                <span className="block text-xs text-muted-foreground">
                  {profile.role === "admin" ? "Producción" : "Mi cuenta"}
                </span>
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                {(profile.full_name || profile.email).charAt(0).toUpperCase()}
              </span>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-6">{children}</main>
    </div>
  );
}
