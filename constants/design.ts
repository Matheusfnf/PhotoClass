/**
 * PhotoClass Design System
 * Dark-first palette with deep indigo + vibrant teal accent.
 */

export const Palette = {
  // Primary
  indigo50: '#EEF0FF',
  indigo100: '#D8DAFF',
  indigo200: '#B3B7FF',
  indigo400: '#8B80FF',
  indigo500: '#6C5CE7',
  indigo600: '#5A45D6',
  indigo700: '#4834B0',
  indigo800: '#362888',

  // Accent
  teal400: '#00F5D4',
  teal500: '#00CEC9',
  teal600: '#00B4A8',

  // Semantic
  success: '#00B894',
  warning: '#FDCB6E',
  error: '#FF7675',
  info: '#74B9FF',

  // Neutrals — dark mode oriented
  gray50: '#F8F9FA',
  gray100: '#E9ECEF',
  gray200: '#DEE2E6',
  gray300: '#CED4DA',
  gray400: '#ADB5BD',
  gray500: '#6C757D',
  gray600: '#495057',
  gray700: '#343A40',
  gray800: '#1E1E2E',
  gray850: '#181825',
  gray900: '#11111B',
  gray950: '#0B0B14',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ThemeName =
  | 'dark'
  | 'light'
  | 'dark-amoled'
  | 'dark-midnight'
  | 'plant-green'
  | 'rose-pink'
  | 'pastel-yellow';

/** Forma de uma paleta — todas as chaves de tema têm exatamente estes campos. */
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  primaryMuted: string;
  accent: string;
  accentMuted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  card: string;
  cardBorder: string;
  overlay: string;
  tabBar: string;
  tabBarBorder: string;
  icon: string;
  iconActive: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export const AppColors: Record<ThemeName, ThemeColors> = {
  dark: {
    background: Palette.gray900,
    surface: Palette.gray850,
    surfaceElevated: Palette.gray800,
    primary: Palette.indigo500,
    primaryMuted: Palette.indigo700,
    accent: Palette.teal400,
    accentMuted: Palette.teal600,
    text: Palette.gray50,
    textSecondary: Palette.gray400,
    textMuted: Palette.gray500,
    border: Palette.gray700,
    borderLight: 'rgba(255,255,255,0.06)',
    card: 'rgba(30, 30, 46, 0.8)',
    cardBorder: 'rgba(108, 92, 231, 0.15)',
    overlay: 'rgba(0,0,0,0.6)',
    tabBar: Palette.gray850,
    tabBarBorder: Palette.gray800,
    icon: Palette.gray400,
    iconActive: Palette.indigo400,
    success: Palette.success,
    warning: Palette.warning,
    error: Palette.error,
    info: Palette.info,
  },
  light: {
    background: Palette.gray50,
    surface: Palette.white,
    surfaceElevated: Palette.white,
    primary: Palette.indigo500,
    primaryMuted: Palette.indigo100,
    accent: Palette.teal500,
    accentMuted: Palette.teal600,
    text: Palette.gray900,
    textSecondary: Palette.gray600,
    textMuted: Palette.gray500,
    border: Palette.gray200,
    borderLight: 'rgba(0,0,0,0.04)',
    card: 'rgba(255,255,255,0.9)',
    cardBorder: 'rgba(108, 92, 231, 0.12)',
    overlay: 'rgba(0,0,0,0.4)',
    tabBar: Palette.white,
    tabBarBorder: Palette.gray200,
    icon: Palette.gray500,
    iconActive: Palette.indigo500,
    success: Palette.success,
    warning: Palette.warning,
    error: Palette.error,
    info: Palette.info,
  },
  'dark-amoled': {
    background: Palette.black,
    surface: Palette.gray950,
    surfaceElevated: Palette.gray900,
    primary: Palette.indigo400,
    primaryMuted: Palette.indigo700,
    accent: Palette.teal400,
    accentMuted: Palette.teal600,
    text: Palette.gray50,
    textSecondary: Palette.gray400,
    textMuted: Palette.gray500,
    border: Palette.gray800,
    borderLight: 'rgba(255,255,255,0.08)',
    card: 'rgba(0, 0, 0, 0.9)',
    cardBorder: 'rgba(108, 92, 231, 0.2)',
    overlay: 'rgba(0,0,0,0.8)',
    tabBar: Palette.black,
    tabBarBorder: Palette.gray900,
    icon: Palette.gray400,
    iconActive: Palette.indigo400,
    success: Palette.success,
    warning: Palette.warning,
    error: Palette.error,
    info: Palette.info,
  },
  'dark-midnight': {
    background: '#0a0f1c',
    surface: '#121828',
    surfaceElevated: '#1a2235',
    primary: '#3b82f6', 
    primaryMuted: '#1d4ed8',
    accent: '#8b5cf6', 
    accentMuted: '#6d28d9',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    border: '#1e293b',
    borderLight: 'rgba(255,255,255,0.05)',
    card: 'rgba(18, 24, 40, 0.9)',
    cardBorder: 'rgba(59, 130, 246, 0.15)',
    overlay: 'rgba(0,0,0,0.7)',
    tabBar: '#0a0f1c',
    tabBarBorder: '#1e293b',
    icon: '#94a3b8',
    iconActive: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#0ea5e9',
  },
  'plant-green': {
    background: '#F1F8F4',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    primary: '#2E7D32',
    primaryMuted: '#C8E6C9',
    accent: '#4CAF50',
    accentMuted: '#81C784',
    text: '#1B5E20',
    textSecondary: '#388E3C',
    textMuted: '#66BB6A',
    border: '#C8E6C9',
    borderLight: 'rgba(46, 125, 50, 0.08)',
    card: 'rgba(255, 255, 255, 0.9)',
    cardBorder: 'rgba(46, 125, 50, 0.15)',
    overlay: 'rgba(0,0,0,0.4)',
    tabBar: '#FFFFFF',
    tabBarBorder: '#C8E6C9',
    icon: '#4CAF50',
    iconActive: '#2E7D32',
    success: Palette.success,
    warning: Palette.warning,
    error: Palette.error,
    info: Palette.info,
  },
  'rose-pink': {
    background: '#FFF0F5',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    primary: '#D81B60',
    primaryMuted: '#F8BBD0',
    accent: '#EC407A',
    accentMuted: '#F48FB1',
    text: '#880E4F',
    textSecondary: '#C2185B',
    textMuted: '#F06292',
    border: '#F8BBD0',
    borderLight: 'rgba(216, 27, 96, 0.08)',
    card: 'rgba(255, 255, 255, 0.9)',
    cardBorder: 'rgba(216, 27, 96, 0.15)',
    overlay: 'rgba(0,0,0,0.4)',
    tabBar: '#FFFFFF',
    tabBarBorder: '#F8BBD0',
    icon: '#EC407A',
    iconActive: '#D81B60',
    success: Palette.success,
    warning: Palette.warning,
    error: Palette.error,
    info: Palette.info,
  },
  'pastel-yellow': {
    background: '#FFFDE7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    primary: '#F57F17',
    primaryMuted: '#FFF59D',
    accent: '#FBC02D',
    accentMuted: '#FFEE58',
    text: '#5D4037',
    textSecondary: '#795548',
    textMuted: '#A1887F',
    border: '#FFF59D',
    borderLight: 'rgba(245, 127, 23, 0.08)',
    card: 'rgba(255, 255, 255, 0.9)',
    cardBorder: 'rgba(245, 127, 23, 0.15)',
    overlay: 'rgba(0,0,0,0.4)',
    tabBar: '#FFFFFF',
    tabBarBorder: '#FFF59D',
    icon: '#FBC02D',
    iconActive: '#F57F17',
    success: Palette.success,
    warning: Palette.warning,
    error: Palette.error,
    info: Palette.info,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  }),
} as const;

/** Preset colors for Space cards */
export const SpaceColors = [
  '#6C5CE7', // Indigo
  '#00CEC9', // Teal
  '#FF7675', // Coral
  '#FDCB6E', // Amber
  '#74B9FF', // Sky
  '#A29BFE', // Lavender
  '#55EFC4', // Mint
  '#FD79A8', // Pink
  '#E17055', // Terracotta
  '#00B894', // Emerald
  '#0984E3', // Blue
  '#B2BEC3', // Slate
] as const;

/** Preset emojis for Spaces */
export const SpaceEmojis = [
  '📚', '🔬', '🧮', '🎨', '💻', '📐', '🌍', '⚗️',
  '📝', '🎵', '🏛️', '💡', '🧬', '📊', '🗣️', '✏️',
  '🔢', '📖', '🎭', '⚖️', '🏥', '🌿', '🔧', '📷',
] as const;
