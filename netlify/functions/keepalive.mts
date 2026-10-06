// Función programada de Netlify: una vez al día llama a /api/health, que hace una
// consulta real a Supabase. Así el plan gratuito de Supabase no pausa el proyecto
// por inactividad (lo hace tras ~7 días sin uso).
export default async () => {
  const base = process.env.URL; // URL pública del sitio, la pone Netlify
  const res = await fetch(`${base}/api/health`, { cache: "no-store" });
  console.log(`keepalive ${res.status} ${await res.text()}`);
};

export const config = { schedule: "@daily" };
