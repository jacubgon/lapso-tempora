"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1.5 overflow-x-auto px-1 py-2.5">
      {items.map((item) => {
        // El enlace más específico que encaje gana (/produccion no se ilumina en /produccion/detalle)
        const matches = (href: string) =>
          href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        const best = items.filter((i) => matches(i.href)).sort((a, b) => b.href.length - a.href.length)[0];
        const active = best?.href === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition",
              active ? "segmented-on" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
