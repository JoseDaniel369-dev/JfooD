import type { MealType } from '@/features/diary/types';

export interface Greeting {
  text: string;
  emoji: string;
}

/** "Buenos días ☀️", "Buenas tardes 🌤️" or "Buenas noches 🌙" for a local hour (0-23). */
export function greetingForHour(hour: number): Greeting {
  if (hour >= 6 && hour < 13) {
    return { text: 'Buenos días', emoji: '☀️' };
  }
  if (hour >= 13 && hour < 21) {
    return { text: 'Buenas tardes', emoji: '🌤️' };
  }
  return { text: 'Buenas noches', emoji: '🌙' };
}

/** The name as it should be greeted: trimmed, one word of at most 20 characters, or null. */
export function cleanDisplayName(raw: string | null | undefined): string | null {
  const name = (raw ?? '').trim().split(/\s+/)[0] ?? '';
  return name === '' ? null : name.slice(0, 20);
}

/** "Buenos días, José" or just "Buenos días" when there is no name. */
export function greetingLine(hour: number, name: string | null | undefined): string {
  const { text } = greetingForHour(hour);
  const clean = cleanDisplayName(name);
  return clean ? `${text}, ${clean}` : text;
}

export const NEXT_MEAL_LABELS: Record<MealType, { label: string; emoji: string }> = {
  breakfast: { label: 'el desayuno', emoji: '🍳' },
  lunch: { label: 'la comida', emoji: '🥗' },
  snack: { label: 'la merienda', emoji: '🍎' },
  dinner: { label: 'la cena', emoji: '🍝' },
};
