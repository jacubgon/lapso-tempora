"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";

export function GroupBySelect({ options, value }: { options: { id: string; label: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Agrupar por
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("agrupar", e.target.value);
          startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
        }}
        className="h-8 rounded-md border border-input bg-card px-2 text-sm text-foreground"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
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
    "btn-outline inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium";
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
