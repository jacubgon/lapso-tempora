import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { fetchAll, loadLookup } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { ProjectsManager } from "@/components/admin/projects-manager";
import { PeopleManager } from "@/components/admin/people-manager";
import { DepartmentsManager } from "@/components/admin/departments-manager";
import { SettingsForm } from "@/components/admin/settings-form";
import type { Membership, Person } from "@/components/admin/shared";

export const metadata = { title: "Gestión" };

const TABS = [
  { id: "proyectos", label: "Proyectos" },
  { id: "personas", label: "Personas" },
  { id: "departamentos", label: "Departamentos" },
  { id: "ajustes", label: "Ajustes" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function GestionPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === raw) ? (raw as Tab) : "proyectos";
  const { supabase, profile } = await requireAdmin();
  const lookup = await loadLookup(supabase);
  const memberships = await fetchAll<Membership>((from, to) =>
    supabase.from("project_members").select("project_id, user_id").range(from, to),
  );
  const people = lookup.people as Person[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Gestión</h1>
        <p className="text-sm text-muted-foreground">Proyectos, personas y reglas del registro de horas.</p>
      </div>

      <nav className="segmented" aria-label="Secciones de gestión">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/produccion/gestion?tab=${t.id}`}
            scroll={false}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              tab === t.id ? "segmented-on" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "proyectos" && (
        <ProjectsManager
          projects={lookup.projects}
          people={people}
          departments={lookup.departments}
          tasks={lookup.tasks}
          memberships={memberships}
        />
      )}
      {tab === "personas" && (
        <PeopleManager
          people={people}
          departments={lookup.departments}
          projects={lookup.projects}
          memberships={memberships}
          currentUserId={profile.id}
        />
      )}
      {tab === "departamentos" && <DepartmentsManager departments={lookup.departments} people={people} />}
      {tab === "ajustes" && <SettingsForm settings={lookup.settings} />}
    </div>
  );
}
