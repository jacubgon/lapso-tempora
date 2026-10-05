import { ImageResponse } from "next/og";
import { brand } from "./brand";

/** Icono de la app generado a partir de la marca (inicial sobre el color principal). */
export function brandIcon(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  // En iconos "maskable" el sistema recorta un círculo: dejamos margen de seguridad.
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const fontSize = Math.round(size * (maskable ? 0.42 : 0.6));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brand.color,
          color: "#ffffff",
          fontSize,
          fontWeight: 800,
          fontFamily: "system-ui",
          borderRadius: radius,
        }}
      >
        {brand.initial}
      </div>
    ),
    { width: size, height: size },
  );
}
