import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.tagline,
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: brand.background,
    theme_color: brand.background,
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Mis horas", url: "/", icons: [{ src: "/icons/192.png", sizes: "192x192" }] }],
  };
}
