const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

export function toLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatLocalDate(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  const weekday = WEEKDAYS[date.getDay()] ?? '';
  const monthName = MONTHS[date.getMonth()] ?? '';

  return `${weekday}, ${date.getDate()} de ${monthName}`;
}

/** "12 nov": a day for chart axes (three letters of the month, no weekday). */
export function formatShortDate(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return `${date.getDate()} ${(MONTHS[date.getMonth()] ?? '').slice(0, 3)}`;
}

export function addDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return toLocalDate(date);
}

/** True for a real calendar date written as YYYY-MM-DD (e.g. rejects 2026-02-31). */
export function isValidLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** The local-time Date of a YYYY-MM-DD day, or null when it is not a real calendar date. */
export function parseLocalDate(localDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null;
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  if (
    date.getFullYear() === year &&
    date.getMonth() === (month ?? 1) - 1 &&
    date.getDate() === day
  ) {
    return date;
  }
  return null;
}

/** Returns the date unchanged or throws a Spanish error when it is not valid. */
export function assertLocalDate(value: string): string {
  if (!isValidLocalDate(value)) {
    throw new Error('La fecha no es válida.');
  }
  return value;
}

/** Monday (YYYY-MM-DD) of the week that contains the date. */
export function startOfWeek(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  const sinceMonday = (date.getDay() + 6) % 7;
  return addDays(localDate, -sinceMonday);
}
