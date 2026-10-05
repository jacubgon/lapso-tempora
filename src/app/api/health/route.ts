import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Comprobación de salud. Hace una consulta real a la base de datos, de modo que
 * llamarla cada pocos días evita que Supabase (plan gratuito) pause el proyecto.
 * No devuelve datos: sin sesión, RLS no deja leer nada.
 */
export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const started = Date.now();
  const { error } = await supabase.from("app_settings").select("id").limit(1);
  return NextResponse.json(
    { ok: !error, db_ms: Date.now() - started },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
