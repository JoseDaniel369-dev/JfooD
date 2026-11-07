export const colors = {
  background: '#F6F7F2',
  surface: '#FFFFFF',
  surfaceMuted: '#EDF0E8',
  primary: '#204E3D',
  primaryDark: '#15382C',
  primaryLight: '#DCE9DF',
  accent: '#D8A84E',
  text: '#18251F',
  textMuted: '#69756E',
  textOnPrimary: '#F8FBF7',
  border: '#E3E8E0',
  danger: '#A4473D',
  dangerLight: '#F5E1DF',
  success: '#3B6E5C',
  overlay: 'rgba(24, 37, 31, 0.45)',
  protein: '#5A7D9A',
  carbohydrates: '#C58B3B',
  fat: '#9A6C85',
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
  pill: 999,
} as const;

export const shadows = {
  sm: {
    elevation: 1,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  md: {
    elevation: 2,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
} as const;

export const typography = {
  display: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
} as const;
