"use server";

import { refresh } from "next/cache";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function updateMyName(fullName: string): Promise<ActionResult> {
  const name = fullName.trim();
  if (!name || name.length > 120) return { ok: false, error: "Escribe tu nombre." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión caducada. Vuelve a entrar." };
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function changeMyPassword(current: string, next: string): Promise<ActionResult> {
  if (next.length < 8) return { ok: false, error: "La nueva contraseña debe tener al menos 8 caracteres." };
  if (next === current) return { ok: false, error: "La nueva contraseña debe ser distinta de la actual." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Sesión caducada. Vuelve a entrar." };

  // Comprobamos la contraseña actual con un cliente aparte, sin tocar la sesión del navegador.
  const probe = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: wrong } = await probe.auth.signInWithPassword({ email: user.email, password: current });
  if (wrong) return { ok: false, error: "La contraseña actual no es correcta." };
  await probe.auth.signOut({ scope: "local" });

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
