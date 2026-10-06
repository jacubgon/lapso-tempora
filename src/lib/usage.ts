import "server-only";

/**
 * Quién ve el panel de uso. Con OWNER_EMAILS (lista separada por comas) solo esas
 * cuentas de producción; sin definir, cualquier cuenta de producción.
 */
export function canSeeUsage(profile: { role: string; email: string }) {
  if (profile.role !== "admin") return false;
  const owners = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return owners.length === 0 || owners.includes(profile.email.toLowerCase());
}

/** Límites de los planes gratuitos (para la proyección de costes). */
export const FREE_DB_BYTES = 500 * 1024 * 1024;
