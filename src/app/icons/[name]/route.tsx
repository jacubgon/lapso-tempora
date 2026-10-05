import { brandIcon } from "@/config/brand-icon";

// Iconos PNG para instalar la app (Android exige 192 y 512 px)
const ICONS: Record<string, { size: number; maskable?: boolean }> = {
  "192.png": { size: 192 },
  "512.png": { size: 512 },
  "maskable-512.png": { size: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const icon = ICONS[(await params).name];
  if (!icon) return new Response("No encontrado", { status: 404 });
  return brandIcon(icon.size, { maskable: icon.maskable });
}
