import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 5400 → "1:30:00" */
export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** 5400 → "1 h 30 min" · 1800 → "30 min" */
export function formatDuration(totalSeconds: number) {
  const mins = Math.round(Math.max(0, totalSeconds) / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Horas decimales, p. ej. para tablas e informes: 5400 → "1,50" */
export function formatHours(totalSeconds: number) {
  return (totalSeconds / 3600).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function entrySeconds(e: { started_at: string; ended_at: string | null }, now = Date.now()) {
  const end = e.ended_at ? new Date(e.ended_at).getTime() : now;
  return (end - new Date(e.started_at).getTime()) / 1000;
}

/** Traduce errores de Postgres/Supabase a mensajes legibles. */
export function friendlyError(message: string | undefined) {
  if (!message) return "Algo ha fallado. Inténtalo de nuevo.";
  if (message.includes("one_running_timer_per_user"))
    return "Ya tienes un cronómetro en marcha.";
  if (message.includes("ended_after_started"))
    return "La hora de fin debe ser posterior a la de inicio.";
  if (message.includes("finished_is_complete"))
    return "Indica título y proyecto antes de guardar.";
  if (message.includes("row-level security"))
    return "No tienes permiso para esta acción.";
  return message;
}
