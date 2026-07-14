import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/// Fecha de hoy en formato "YYYY-MM-DD" (hora local).
export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/// Valida que el string tenga formato "YYYY-MM-DD"; si no, devuelve hoy.
export function normalizeDateISO(value: string | undefined | null): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return todayISO();
}

/// Suma (o resta) días a una fecha "YYYY-MM-DD".
export function addDaysISO(dateISO: string, amount: number): string {
  return format(addDays(parseISO(dateISO), amount), "yyyy-MM-dd");
}

/// Formato largo legible, ej. "miércoles 8 de julio de 2026".
export function formatLongDate(dateISO: string): string {
  return format(parseISO(dateISO), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
}

/// Formato corto, ej. "Mié 8 jul".
export function formatShortDate(dateISO: string): string {
  return format(parseISO(dateISO), "EEE d MMM", { locale: es });
}

/// Devuelve el lunes de la semana que contiene la fecha dada ("YYYY-MM-DD").
export function getWeekStartISO(dateISO: string): string {
  const d = parseISO(dateISO);
  const day = d.getDay(); // 0 (dom) .. 6 (sáb)
  const diff = day === 0 ? -6 : 1 - day; // mover hasta el lunes
  return format(addDays(d, diff), "yyyy-MM-dd");
}

/// Día de la semana (0 dom .. 6 sáb) de una fecha "YYYY-MM-DD".
export function dowOf(dateISO: string): number {
  return parseISO(dateISO).getDay();
}

/// Etiqueta corta de día, ej. "lun 8".
export function formatWeekday(dateISO: string): string {
  return format(parseISO(dateISO), "EEE d", { locale: es });
}

/// Nombre del día de la semana en minúsculas, ej. "sábado".
export function formatWeekdayName(dateISO: string): string {
  return format(parseISO(dateISO), "EEEE", { locale: es }).toLowerCase();
}
