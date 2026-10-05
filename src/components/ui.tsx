"use client";

import { forwardRef, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon";

// Neumorfismo: los botones sobresalen y se hunden al pulsarlos
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground neu-raised-sm hover:brightness-110 active:neu-inset-sm",
  secondary: "neu-btn",
  ghost: "text-muted-foreground hover:text-foreground hover:neu-raised-sm active:neu-inset-sm",
  danger: "bg-destructive text-white neu-raised-sm hover:brightness-110 active:neu-inset-sm",
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  icon: "h-9 w-9",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ className, variant = "primary", size = "md", type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium transition disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
});

// Campos hundidos en la superficie
const fieldBase =
  "h-10 w-full rounded-xl border-0 bg-background px-3 text-sm neu-inset-sm placeholder:text-muted-foreground/80 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(fieldBase, "pr-8", className)} {...props} />;
  },
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl bg-card neu-raised", className)}
      {...props}
    />
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border-0 bg-card p-0 text-foreground neu-raised backdrop:bg-black/30 backdrop:backdrop-blur-[3px]",
        className,
      )}
    >
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
              <X className="size-4" />
            </Button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
