export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  onAccent: string;
  /** Text/icons for "careful" states (near or over a goal). Never red: it is not an error. */
  warning: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  onHero: string;
  toastSuccess: string;
  border: string;
  danger: string;
  onDanger: string;
  dangerLight: string;
  success: string;
  overlay: string;
  protein: string;
  carbohydrates: string;
  fat: string;
  water: string;
}

export const lightColors: ThemeColors = {
  background: '#F7F8F2',
  surface: '#FFFFFF',
  surfaceMuted: '#E8F2EC',
  primary: '#047857',
  primaryDark: '#065F46',
  primaryLight: '#D1FAE5',
  accent: '#F97316',
  onAccent: '#431407',
  warning: '#B45309',
  text: '#0F1D18',
  textMuted: '#5B6B63',
  textOnPrimary: '#FFFFFF',
  onHero: '#FFFFFF',
  toastSuccess: '#047857',
  border: '#DFEAE3',
  danger: '#DC2626',
  onDanger: '#FFFFFF',
  dangerLight: '#FDE8E8',
  success: '#16A34A',
  overlay: 'rgba(15, 29, 24, 0.5)',
  protein: '#3B82F6',
  carbohydrates: '#F59E0B',
  fat: '#EC4899',
  water: '#0284C7',
};

export const darkColors: ThemeColors = {
  background: '#0A1411',
  surface: '#12211C',
  surfaceMuted: '#1B2F28',
  primary: '#34D399',
  primaryDark: '#6EE7B7',
  primaryLight: '#14372E',
  accent: '#FB923C',
  onAccent: '#431407',
  warning: '#FBBF24',
  text: '#EAF6EF',
  textMuted: '#93AFA2',
  textOnPrimary: '#052E21',
  onHero: '#FFFFFF',
  toastSuccess: '#0E3A2C',
  border: '#234038',
  danger: '#F87171',
  onDanger: '#450A0A',
  dangerLight: '#3B1D1D',
  success: '#4ADE80',
  overlay: 'rgba(0, 0, 0, 0.6)',
  protein: '#60A5FA',
  carbohydrates: '#FBBF24',
  fat: '#F472B6',
  water: '#38BDF8',
};

/** Green gradient used by the hero/calorie cards. AA-safe for white text. */
export const heroGradient = ['#047857', '#065F46'] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const shadows = {
  sm: {
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  md: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
} as const;

/** Nunito families. Android needs one family per weight (it ignores fontWeight for custom fonts). */
export const fonts = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  heading: 'Nunito_700Bold',
  brand: 'Nunito_800ExtraBold',
} as const;

export const typography = {
  display: {
    fontFamily: fonts.brand,
    fontSize: 32,
    letterSpacing: -0.8,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  caption: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: 11,
    letterSpacing: 1.2,
  },
} as const;

/** Spread into numeric Text styles so digits keep a constant width. */
export const tabularNumbers = { fontVariant: ['tabular-nums' as const] };
