import { getSession } from "@/lib/session";
import { Tracker } from "@/components/tracker/tracker";
import type { Project, Task, TimeEntry } from "@/lib/types";

export const metadata = { title: "Mis horas" };

const ENTRY_COLS = "id, user_id, title, project_id, task_id, started_at, ended_at, source";

/** Margen de una semana extra: el cliente recorta a semanas completas en su zona horaria. */
function historySince(weeks: number) {
  return new Date(Date.now() - (weeks + 1) * 7 * 864e5).toISOString();
}

export default async function TrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ semanas?: string }>;
}) {
  const { supabase, profile } = await getSession();
  const weeks = Math.min(52, Math.max(1, Number((await searchParams).semanas) || 4));
  const since = historySince(weeks);

  const [projectsRes, tasksRes, runningRes, entriesRes, settingsRes] = await Promise.all([
    supabase.from("projects").select("id, name, client, color, archived").order("name"),
    supabase.from("tasks").select("id, project_id, name").order("name"),
    supabase
      .from("time_entries")
      .select(ENTRY_COLS)
      .eq("user_id", profile.id)
      .is("ended_at", null)
      .maybeSingle(),
    supabase
      .from("time_entries")
      .select(ENTRY_COLS)
      .eq("user_id", profile.id)
      .not("ended_at", "is", null)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(2000),
    supabase.from("app_settings").select("lock_before").eq("id", 1).maybeSingle(),
  ]);

  return (
    <Tracker
      running={(runningRes.data as TimeEntry | null) ?? null}
      entries={(entriesRes.data as TimeEntry[]) ?? []}
      projects={(projectsRes.data as Project[]) ?? []}
      tasks={(tasksRes.data as Task[]) ?? []}
      weeks={weeks}
      lockBefore={settingsRes.data?.lock_before ?? null}
      canBypassLock={profile.role === "admin"}
    />
  );
}
