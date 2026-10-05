"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

async function adminSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión caducada. Vuelve a entrar.");
  const { data: me } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  if (me?.role !== "admin" || !me.active) throw new Error("Solo producción puede hacer esto.");
  return { supabase, userId: user.id };
}

async function run(fn: () => Promise<string | null | void>): Promise<ActionResult> {
  try {
    const err = await fn();
    if (err) return { ok: false, error: friendlyError(err) };
  } catch (e) {
    return { ok: false, error: friendlyError((e as Error).message) };
  }
  refresh();
  return { ok: true };
}

function uniqueViolation(msg: string, what: string) {
  return /duplicate key|unique/i.test(msg) ? `Ya existe ${what} con ese nombre.` : msg;
}

const uuid = z.uuid();
const uuids = z.array(z.uuid()).max(500);

// --- Proyectos --------------------------------------------------------------------

const projectSchema = z.object({
  name: z.string().trim().min(1, "Pon un nombre al proyecto").max(120),
  client: z.string().trim().max(120),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  archived: z.boolean(),
  memberIds: uuids,
});

export async function saveProject(id: string | null, input: z.infer<typeof projectSchema>) {
  return run(async () => {
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) return parsed.error.issues[0].message;
    if (id && !uuid.safeParse(id).success) return "Datos no válidos.";
    const { supabase } = await adminSession();
    const { memberIds, ...p } = parsed.data;
    const values = { ...p, client: p.client || null };

    let projectId = id;
    if (id) {
      const { error } = await supabase.from("projects").update(values).eq("id", id);
      if (error) return uniqueViolation(error.message, "un proyecto");
    } else {
      const { data, error } = await supabase.from("projects").insert(values).select("id").single();
      if (error) return uniqueViolation(error.message, "un proyecto");
      projectId = data.id;
    }

    // Sincronizar miembros
    const { data: current } = await supabase.from("project_members").select("user_id").eq("project_id", projectId!);
    const have = new Set((current ?? []).map((m) => m.user_id));
    const want = new Set(memberIds);
    const toAdd = memberIds.filter((u) => !have.has(u));
    const toRemove = [...have].filter((u) => !want.has(u));
    if (toAdd.length) {
      const { error } = await supabase
        .from("project_members")
        .insert(toAdd.map((user_id) => ({ project_id: projectId!, user_id })));
      if (error) return error.message;
    }
    if (toRemove.length) {
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId!)
        .in("user_id", toRemove);
      if (error) return error.message;
    }
  });
}

export async function deleteProject(id: string) {
  return run(async () => {
    if (!uuid.safeParse(id).success) return "Datos no válidos.";
    const { supabase } = await adminSession();
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error)
      return /foreign key/i.test(error.message)
        ? "El proyecto tiene horas registradas: archívalo en lugar de borrarlo."
        : error.message;
  });
}

// --- Subtareas (limpieza por producción) -------------------------------------------

export async function renameTask(id: string, name: string) {
  return run(async () => {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!uuid.safeParse(id).success || !clean) return "Datos no válidos.";
    const { supabase } = await adminSession();
    const { error } = await supabase.from("tasks").update({ name: clean }).eq("id", id);
    if (error) return uniqueViolation(error.message, "una subtarea");
  });
}

export async function deleteTask(id: string) {
  return run(async () => {
    if (!uuid.safeParse(id).success) return "Datos no válidos.";
    const { supabase } = await adminSession();
    // Las entradas que la usaban quedan "sin subtarea" (on delete set null)
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return error.message;
  });
}

// --- Personas ---------------------------------------------------------------------

const personBase = z.object({
  full_name: z.string().trim().min(1, "Pon el nombre").max(120),
  department_id: z.uuid().nullable(),
  role: z.enum(["user", "admin"]),
  projectIds: uuids,
});

const newPersonSchema = personBase.extend({
  email: z.email("Email no válido").trim().toLowerCase(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
});

async function syncPersonProjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectIds: string[],
) {
  const { data: current } = await supabase.from("project_members").select("project_id").eq("user_id", userId);
  const have = new Set((current ?? []).map((m) => m.project_id));
  const want = new Set(projectIds);
  const toAdd = projectIds.filter((p) => !have.has(p));
  const toRemove = [...have].filter((p) => !want.has(p));
  if (toAdd.length) {
    const { error } = await supabase
      .from("project_members")
      .insert(toAdd.map((project_id) => ({ project_id, user_id: userId })));
    if (error) return error.message;
  }
  if (toRemove.length) {
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("user_id", userId)
      .in("project_id", toRemove);
    if (error) return error.message;
  }
  return null;
}

export async function createPerson(input: z.infer<typeof newPersonSchema>) {
  return run(async () => {
    const parsed = newPersonSchema.safeParse(input);
    if (!parsed.success) return parsed.error.issues[0].message;
    const { supabase } = await adminSession();
    const admin = createAdminClient();
    const p = parsed.data;

    const { data, error } = await admin.auth.admin.createUser({
      email: p.email,
      password: p.password,
      email_confirm: true,
      user_metadata: { full_name: p.full_name },
    });
    if (error)
      return /already|registered|exists/i.test(error.message) ? "Ya existe una cuenta con ese email." : error.message;

    // El trigger ya creó el perfil; completamos datos
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ full_name: p.full_name, department_id: p.department_id, role: p.role })
      .eq("id", data.user.id);
    if (upErr) return upErr.message;
    return syncPersonProjects(supabase, data.user.id, p.projectIds);
  });
}

const updatePersonSchema = personBase.extend({ active: z.boolean() });

export async function updatePerson(id: string, input: z.infer<typeof updatePersonSchema>) {
  return run(async () => {
    const parsed = updatePersonSchema.safeParse(input);
    if (!parsed.success) return parsed.error.issues[0].message;
    if (!uuid.safeParse(id).success) return "Datos no válidos.";
    const { supabase, userId } = await adminSession();
    const p = parsed.data;
    if (id === userId && (p.role !== "admin" || !p.active))
      return "No puedes quitarte a ti mismo el acceso de producción.";

    const { data: before } = await supabase.from("profiles").select("active").eq("id", id).single();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: p.full_name, department_id: p.department_id, role: p.role, active: p.active })
      .eq("id", id);
    if (error) return error.message;

    // Desactivar = bloquear el inicio de sesión en auth también
    if (before && before.active !== p.active) {
      const { error: banErr } = await createAdminClient().auth.admin.updateUserById(id, {
        ban_duration: p.active ? "none" : "876000h",
      });
      if (banErr) return banErr.message;
    }
    return syncPersonProjects(supabase, id, p.projectIds);
  });
}

export async function resetPassword(id: string, password: string) {
  return run(async () => {
    if (!uuid.safeParse(id).success) return "Datos no válidos.";
    if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    await adminSession();
    const { error } = await createAdminClient().auth.admin.updateUserById(id, { password });
    if (error) return error.message;
  });
}

// --- Departamentos ----------------------------------------------------------------

export async function saveDepartment(id: string | null, name: string) {
  return run(async () => {
    const clean = name.trim();
    if (!clean) return "Pon un nombre al departamento.";
    if (id && !uuid.safeParse(id).success) return "Datos no válidos.";
    const { supabase } = await adminSession();
    const { error } = id
      ? await supabase.from("departments").update({ name: clean }).eq("id", id)
      : await supabase.from("departments").insert({ name: clean });
    if (error) return uniqueViolation(error.message, "un departamento");
  });
}

export async function deleteDepartment(id: string) {
  return run(async () => {
    if (!uuid.safeParse(id).success) return "Datos no válidos.";
    const { supabase } = await adminSession();
    // Las personas del departamento quedan "sin departamento" (on delete set null)
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) return error.message;
  });
}

// --- Auditoría --------------------------------------------------------------------

export type AuditRow = {
  action: "insert" | "update" | "delete";
  changed_at: string;
  changed_by: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

export async function getEntryAudit(entryId: string): Promise<{ ok: true; rows: AuditRow[] } | { ok: false; error: string }> {
  try {
    if (!uuid.safeParse(entryId).success) return { ok: false, error: "Datos no válidos." };
    const { supabase } = await adminSession();
    const { data, error } = await supabase
      .from("time_entry_audit")
      .select("action, changed_at, changed_by, old_data, new_data")
      .eq("entry_id", entryId)
      .order("changed_at", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: (data ?? []) as AuditRow[] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// --- Ajustes ----------------------------------------------------------------------

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

const settingsSchema = z.object({
  lock_before: day,
  cycle_anchor: day,
  cycle_days: z.number().int().min(1).max(90),
});

export async function saveSettings(input: z.infer<typeof settingsSchema>) {
  return run(async () => {
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) return "Revisa los valores.";
    const { supabase } = await adminSession();
    const { error } = await supabase
      .from("app_settings")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return error.message;
  });
}
