export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  primary: string;
  primaryLight: string;
  accent: string;
  onAccent: string;
  /** Text/icons for "careful" states (near or over a goal). Never red: it is not an error. */
  warning: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  onHero: string;
  /** Secondary text over the hero gradient (AA on every stop, unlike a faded white). */
  onHeroMuted: string;
  /** Raised element on a muted surface (selected segment, chips): visible in dark mode, where shadows are not. */
  surfaceRaised: string;
  /** Green for small "ok" text (AA on the surface in both themes; `success` is for icons and fills). */
  successText: string;
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
  /** Vivid brand green for decorative surfaces and strokes (never for small text). */
  primaryBright: string;
  /** Soft tinted backgrounds that carry each macro's colour. */
  proteinLight: string;
  carbohydratesLight: string;
  fatLight: string;
  waterLight: string;
  /** Gold used for celebrations (goal reached, achievements). */
  celebrate: string;
}

export const lightColors: ThemeColors = {
  background: '#F7F8F2',
  surface: '#FFFFFF',
  surfaceMuted: '#E8F2EC',
  primary: '#047857',
  primaryLight: '#D1FAE5',
  accent: '#F97316',
  onAccent: '#431407',
  warning: '#B45309',
  text: '#0F1D18',
  textMuted: '#5B6B63',
  textOnPrimary: '#FFFFFF',
  onHero: '#FFFFFF',
  onHeroMuted: '#EAF7F1',
  surfaceRaised: '#FFFFFF',
  successText: '#166534',
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
  primaryBright: '#10B981',
  proteinLight: '#DBEAFE',
  carbohydratesLight: '#FEF3C7',
  fatLight: '#FCE7F3',
  waterLight: '#E0F2FE',
  celebrate: '#FACC15',
};

export const darkColors: ThemeColors = {
  background: '#0A1411',
  surface: '#12211C',
  surfaceMuted: '#1B2F28',
  primary: '#34D399',
  primaryLight: '#14372E',
  accent: '#FB923C',
  onAccent: '#431407',
  warning: '#FBBF24',
  text: '#EAF6EF',
  textMuted: '#93AFA2',
  textOnPrimary: '#052E21',
  onHero: '#FFFFFF',
  onHeroMuted: '#EAF7F1',
  surfaceRaised: '#2A4A3F',
  successText: '#4ADE80',
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
  primaryBright: '#34D399',
  proteinLight: '#16294A',
  carbohydratesLight: '#3A2F10',
  fatLight: '#3B1A2C',
  waterLight: '#0C2F44',
  celebrate: '#FDE047',
};

/**
 * Green → teal sweep of the hero/calorie cards. Every stop keeps AA contrast
 * for white text (see tokens.test.ts).
 */
export const heroGradient = ['#047857', '#0E7C66', '#115E59'] as const;

/** Deeper sweep for dark mode: the bright light-mode green would glare on the near-black canvas. */
export const heroGradientDark = ['#065F46', '#0B6B5C', '#134E4A'] as const;

/** Decorative gradients (no text is drawn directly over them). */
export const gradients = {
  accent: ['#FFA24D', '#FF7A1A'],
  water: ['#38BDF8', '#0284C7'],
} as const;

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
  xl: 32,
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

/** Soft shadow tinted with a colour, for hero cards and the central "+" button. */
export function glow(color: string, strength = 0.35) {
  return {
    elevation: 8,
    shadowColor: color,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: strength,
    shadowRadius: 20,
  } as const;
}

/** Nunito families. Android needs one family per weight (it ignores fontWeight for custom fonts). */
export const fonts = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  heading: 'Nunito_700Bold',
  brand: 'Nunito_800ExtraBold',
} as const;

/**
 * Every font size the app uses. Screens pick one of these instead of a loose
 * number, so text stays on one scale (and one place changes it).
 */
export const fontSizes = {
  micro: 11,
  small: 12,
  caption: 13,
  compact: 14,
  body: 15,
  bodyLarge: 16,
  title: 18,
  subtitle: 20,
  heading: 22,
  headline: 24,
  titleLarge: 28,
  display: 32,
  numeral: 40,
  displayLarge: 48,
} as const;

export const typography = {
  /** Big hero numbers (calories left, weight). Use with tabularNumbers. */
  displayLarge: {
    fontFamily: fonts.brand,
    fontSize: fontSizes.displayLarge,
    letterSpacing: -1.5,
  },
  display: {
    fontFamily: fonts.brand,
    fontSize: fontSizes.display,
    letterSpacing: -0.8,
  },
  /** Title of a tab screen. */
  titleLarge: {
    fontFamily: fonts.brand,
    fontSize: fontSizes.titleLarge,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  headline: {
    fontFamily: fonts.brand,
    fontSize: fontSizes.headline,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.title,
    lineHeight: 24,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    lineHeight: 21,
  },
  /** Body text that must stand out (names, button labels). */
  bodyStrong: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.body,
    lineHeight: 21,
  },
  caption: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.caption,
    lineHeight: 18,
  },
  captionStrong: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.caption,
    lineHeight: 18,
  },
  /** Smallest readable text (hints under numbers, tab labels). */
  micro: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.micro,
    lineHeight: 14,
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.micro,
    letterSpacing: 1.2,
    lineHeight: 14,
  },
} as const;

/** Spread into numeric Text styles so digits keep a constant width. */
export const tabularNumbers = { fontVariant: ['tabular-nums' as const] };

/** Empty part of a ring drawn over the hero gradient (decorative). */
export const onHeroTrack = 'rgba(255, 255, 255, 0.2)';
