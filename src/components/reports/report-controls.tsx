"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

export function GroupBySelect({ options, value }: { options: { id: string; label: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <div className="segmented" role="radiogroup" aria-label="Agrupar por">
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.set("agrupar", o.id);
            startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
          }}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-medium transition",
            value === o.id ? "segmented-on" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Enlaces de descarga que heredan los filtros actuales de la URL. */
export function ExportLinks({ kind }: { kind: "resumen" | "detalle" }) {
  const params = useSearchParams();
  const href = (formato: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete("pagina");
    next.set("tipo", kind);
    next.set("formato", formato);
    return `/produccion/exportar?${next.toString()}`;
  };
  const cls =
    "neu-btn inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium";
  return (
    <div className="flex gap-2">
      <a href={href("xlsx")} className={cls}>
        <Download className="size-4" /> Excel
      </a>
      <a href={href("csv")} className={cls}>
        <Download className="size-4" /> CSV
      </a>
    </div>
  );
}
