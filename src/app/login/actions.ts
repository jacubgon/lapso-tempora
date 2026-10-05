"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Introduce email y contraseña.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email o contraseña incorrectos.", email };

  redirect("/");
}

export type ResetState = { sent?: boolean; error?: string; email?: string };

export async function requestPasswordReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Escribe un email válido.", email };

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/restablecer`,
  });
  // Por seguridad no revelamos si el email existe; solo avisamos de límites de envío.
  if (error && /rate|limit|seconds/i.test(error.message))
    return { error: "Has pedido varios enlaces seguidos. Espera unos minutos y vuelve a intentarlo.", email };
  return { sent: true, email };
}

export async function setNewPassword(password: string): Promise<{ ok: boolean; error?: string }> {
  if (password.length < 8) return { ok: false, error: "Mínimo 8 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error)
    return {
      ok: false,
      error: /different|same/i.test(error.message) ? "Elige una contraseña distinta de la anterior." : error.message,
    };
  return { ok: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
