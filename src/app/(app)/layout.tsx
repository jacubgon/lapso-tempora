import Link from "next/link";
import { LogOut } from "lucide-react";
import { brand } from "@/config/brand";
import { getSession } from "@/lib/session";
import { logout } from "@/app/login/actions";
import { Nav, type NavItem } from "@/components/shell/nav";

const userNav: NavItem[] = [{ href: "/", label: "Mis horas" }];
const adminNav: NavItem[] = [];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getSession();
  const items = profile.role === "admin" ? [...userNav, ...adminNav] : userNav;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 py-3">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              {brand.initial}
            </span>
            <span className="font-semibold tracking-tight">{brand.name}</span>
          </Link>
          <div className="min-w-0 flex-1">
            <Nav items={items} />
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium">{profile.full_name || profile.email}</p>
              <p className="text-xs text-muted-foreground">
                {profile.role === "admin" ? "Producción" : profile.email}
              </p>
            </div>
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
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
