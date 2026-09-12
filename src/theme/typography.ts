import { TextStyle } from 'react-native';

/**
 * System fonts for Milestone 2 (custom display fonts are a later decision).
 * Sizes are phone-first and comfortably readable.
 */
export const fontSizes = {
  caption: 12,
  small: 14,
  body: 16,
  subtitle: 18,
  title: 22,
  heading: 28,
  display: 34,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/**
 * The Modern look's faces, loaded by the root layout before anything renders.
 * `display` is the arcade pixel face for plaques and buttons; `mono` sets the
 * intro descriptions. Keys match the names `useFonts` registers them under.
 */
export const fonts = {
  display: 'Jersey20_400Regular',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const lineHeights = {
  caption: 16,
  small: 20,
  body: 22,
  subtitle: 24,
  title: 28,
  heading: 34,
  display: 40,
} as const;
