import { brandIcon } from "@/config/brand-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS aplica sus propias esquinas redondeadas: icono cuadrado a sangre
export default function AppleIcon() {
  return brandIcon(180, { maskable: true });
}
