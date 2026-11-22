export type BmiCategory =
  | 'underweight'
  | 'normal'
  | 'overweight'
  | 'obesity';

export interface BmiResult {
  value: number;
  category: BmiCategory;
  label: string;
}

export const BMI_CATEGORY_LABELS: Record<BmiCategory, string> = {
  underweight: 'Bajo peso',
  normal: 'Normal',
  overweight: 'Sobrepeso',
  obesity: 'Obesidad',
};

/**
 * Body mass index (kg/m²). Returns null for invalid inputs.
 */
export function computeBmi(weightKg: number, heightCm: number): BmiResult | null {
  if (
    !Number.isFinite(weightKg) ||
    !Number.isFinite(heightCm) ||
    weightKg <= 0 ||
    heightCm <= 0
  ) {
    return null;
  }

  const heightMeters = heightCm / 100;
  // Classify the value that is shown: 24.96 is displayed as 25.0 and must read "overweight".
  const value = Math.round((weightKg / (heightMeters * heightMeters)) * 10) / 10;
  let category: BmiCategory;

  if (value < 18.5) {
    category = 'underweight';
  } else if (value < 25) {
    category = 'normal';
  } else if (value < 30) {
    category = 'overweight';
  } else {
    category = 'obesity';
  }

  return {
    value,
    category,
    label: BMI_CATEGORY_LABELS[category],
  };
}
