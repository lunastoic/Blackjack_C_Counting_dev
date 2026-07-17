import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontSizes, fontWeights, spacing } from '../../theme';
import { IconButton } from './IconButton';

interface ScreenTitleRowProps {
  readonly title: string;
  /** Hide the back button (e.g. on Home). */
  readonly showBack?: boolean;
}

/** In-screen title row with a native back action (Android hardware back also works). */
export function ScreenTitleRow({ title, showBack = true }: ScreenTitleRowProps) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      {showBack ? (
        <IconButton
          glyph="‹"
          accessibilityLabel="Go back"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
        />
      ) : null}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {showBack ? <View style={styles.spacer} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  spacer: {
    width: 44,
  },
});
