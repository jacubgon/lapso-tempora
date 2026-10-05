import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente con la clave secreta: salta RLS. Solo para operaciones de auth (crear usuarios, contraseñas). */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
