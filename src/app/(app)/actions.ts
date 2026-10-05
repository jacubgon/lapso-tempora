"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const fieldsSchema = z.object({
  title: z.string().trim().max(300),
  projectId: z.uuid().nullable(),
  taskName: z.string().trim().max(120),
});
type Fields = z.infer<typeof fieldsSchema>;

const idSchema = z.uuid();

function fail(message?: string): ActionResult {
  return { ok: false, error: friendlyError(message) };
}

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión caducada. Vuelve a entrar.");
  return { supabase, userId: user.id };
}

async function resolveTask(supabase: Supabase, projectId: string | null, taskName: string) {
  if (!projectId || !taskName) return { taskId: null as string | null };
  const { data, error } = await supabase.rpc("get_or_create_task", {
    p_project: projectId,
    p_name: taskName,
  });
  if (error) return { error: error.message };
  return { taskId: (data as string | null) ?? null };
}

type Row = { title: string; project_id: string | null; task_id: string | null };

async function toRow(
  supabase: Supabase,
  f: Fields,
): Promise<{ row: Row; error?: undefined } | { row?: undefined; error: string }> {
  const task = await resolveTask(supabase, f.projectId, f.taskName);
  if ("error" in task) return { error: task.error ?? "Error al guardar la subtarea" };
  return { row: { title: f.title, project_id: f.projectId, task_id: task.taskId } };
}

function requireComplete(f: Fields) {
  if (!f.title) return "Escribe un título para la tarea.";
  if (!f.projectId) return "Elige un proyecto.";
  return null;
}

/** Para el cronómetro en marcha (si lo hay) antes de arrancar otro. */
async function stopRunningIfAny(supabase: Supabase, userId: string) {
  const { data: running } = await supabase
    .from("time_entries")
    .select("id, title, project_id, started_at")
    .eq("user_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (!running) return null;
  if (!running.title.trim() || !running.project_id)
    return "Completa título y proyecto del cronómetro actual (o descártalo) antes de empezar otro.";
  const end = Math.max(Date.now(), new Date(running.started_at).getTime() + 1000);
  const { error } = await supabase
    .from("time_entries")
    .update({ ended_at: new Date(end).toISOString() })
    .eq("id", running.id);
  return error?.message ?? null;
}

// --- Cronómetro -------------------------------------------------------------

export async function startTimer(input: Fields): Promise<ActionResult> {
  const parsed = fieldsSchema.safeParse(input);
  if (!parsed.success) return fail("Datos no válidos.");
  try {
    const { supabase, userId } = await authed();
    const r = await toRow(supabase, parsed.data);
    if (!r.row) return fail(r.error);
    const { error } = await supabase.from("time_entries").insert({
      ...r.row,
      user_id: userId,
      started_at: new Date().toISOString(),
      source: "timer",
    });
    if (error) return fail(error.message);
  } catch (e) {
    return fail((e as Error).message);
  }
  refresh();
  return { ok: true };
}

export async function updateRunning(id: string, input: Fields): Promise<ActionResult> {
  const parsed = fieldsSchema.safeParse(input);
  if (!parsed.success || !idSchema.safeParse(id).success) return fail("Datos no válidos.");
  try {
    const { supabase } = await authed();
    const r = await toRow(supabase, parsed.data);
    if (!r.row) return fail(r.error);
    const { error } = await supabase
      .from("time_entries")
      .update(r.row)
      .eq("id", id)
      .is("ended_at", null);
    if (error) return fail(error.message);
  } catch (e) {
    return fail((e as Error).message);
  }
  return { ok: true };
}

/**
 * Para el cronómetro. `endedAt` permite fijar la hora real de fin
 * (p. ej. si se olvidó pararlo); por defecto, ahora.
 */
export async function stopTimer(id: string, input: Fields, endedAt?: string): Promise<ActionResult> {
  const parsed = fieldsSchema.safeParse(input);
  if (!parsed.success || !idSchema.safeParse(id).success) return fail("Datos no válidos.");
  if (endedAt && !z.iso.datetime({ offset: true }).safeParse(endedAt).success) return fail("Hora de fin no válida.");
  if (endedAt && new Date(endedAt).getTime() > Date.now() + 60_000) return fail("La hora de fin no puede ser futura.");
  const missing = requireComplete(parsed.data);
  if (missing) return fail(missing);
  try {
    const { supabase } = await authed();
    const r = await toRow(supabase, parsed.data);
    if (!r.row) return fail(r.error);
    const { data: entry } = await supabase
      .from("time_entries")
      .select("started_at")
      .eq("id", id)
      .single();
    const startMs = entry ? new Date(entry.started_at).getTime() : 0;
    if (endedAt && new Date(endedAt).getTime() <= startMs)
      return fail("La hora de fin debe ser posterior a la de inicio.");
    // Si se para en el mismo segundo, garantizamos fin > inicio.
    const end = endedAt ? new Date(endedAt).getTime() : Math.max(Date.now(), startMs + 1000);
    const { error } = await supabase
      .from("time_entries")
      .update({ ...r.row, ended_at: new Date(end).toISOString() })
      .eq("id", id)
      .is("ended_at", null);
    if (error) return fail(error.message);
  } catch (e) {
    return fail((e as Error).message);
  }
  refresh();
  return { ok: true };
}

export async function discardTimer(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return fail("Datos no válidos.");
  try {
    const { supabase } = await authed();
    const { error } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", id)
      .is("ended_at", null);
    if (error) return fail(error.message);
  } catch (e) {
    return fail((e as Error).message);
  }
  refresh();
  return { ok: true };
}

/** Arranca un cronómetro nuevo con los datos de una entrada anterior. */
export async function continueEntry(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return fail("Datos no válidos.");
  try {
    const { supabase, userId } = await authed();
    const { data: src, error: readErr } = await supabase
      .from("time_entries")
      .select("title, project_id, task_id")
      .eq("id", id)
      .single();
    if (readErr || !src) return fail(readErr?.message);
    const stopErr = await stopRunningIfAny(supabase, userId);
    if (stopErr) return fail(stopErr);
    const { error } = await supabase.from("time_entries").insert({
      ...src,
      user_id: userId,
      started_at: new Date().toISOString(),
      source: "timer",
    });
    if (error) return fail(error.message);
  } catch (e) {
    return fail((e as Error).message);
  }
  refresh();
  return { ok: true };
}

// --- Entradas manuales / edición ---------------------------------------------

const entrySchema = fieldsSchema.extend({
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }),
});

export async function saveEntry(
  id: string | null,
  input: z.infer<typeof entrySchema>,
): Promise<ActionResult> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return fail("Revisa la fecha y las horas.");
  if (id && !idSchema.safeParse(id).success) return fail("Datos no válidos.");
  const missing = requireComplete(parsed.data);
  if (missing) return fail(missing);

  const { startedAt, endedAt } = parsed.data;
  const secs = (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000;
  if (secs <= 0) return fail("La hora de fin debe ser posterior a la de inicio.");
  if (secs > 24 * 3600) return fail("Una entrada no puede durar más de 24 horas.");

  try {
    const { supabase, userId } = await authed();
    const r = await toRow(supabase, parsed.data);
    if (!r.row) return fail(r.error);
    const values = { ...r.row, started_at: startedAt, ended_at: endedAt };
    const { error } = id
      ? await supabase.from("time_entries").update(values).eq("id", id)
      : await supabase
          .from("time_entries")
          .insert({ ...values, user_id: userId, source: "manual" });
    if (error) return fail(error.message);
  } catch (e) {
    return fail((e as Error).message);
  }
  refresh();
  return { ok: true };
}

export async function deleteEntry(id: string): Promise<ActionResult> {
  if (!idSchema.safeParse(id).success) return fail("Datos no válidos.");
  try {
    const { supabase } = await authed();
    const { error } = await supabase.from("time_entries").delete().eq("id", id);
    if (error) return fail(error.message);
  } catch (e) {
    return fail((e as Error).message);
  }
  refresh();
  return { ok: true };
}
