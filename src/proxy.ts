import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Fuera quedan estáticos, iconos y el manifest de la PWA (deben cargarse sin sesión)
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|api/health|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
