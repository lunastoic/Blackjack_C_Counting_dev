import { Platform, ViewStyle } from 'react-native';

/** Cross-platform elevation presets (shadow* on iOS, elevation on Android). */
function shadow(opacity: number, radius: number, height: number, elevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    android: { elevation },
    default: {
      shadowColor: '#000000',
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height },
    },
  })!;
}

export const shadows = {
  none: {} as ViewStyle,
  card: shadow(0.35, 6, 3, 4),
  raised: shadow(0.45, 10, 5, 8),
  overlay: shadow(0.6, 16, 8, 12),
} as const;
