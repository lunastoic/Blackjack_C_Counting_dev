import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, spacing } from '../../theme';
import { useHydrationStore } from '../../stores/hydrationStore';

interface LoadingGateProps {
  readonly children: React.ReactNode;
}

/**
 * Blocks the UI until the persisted save has hydrated, so screens never
 * flash default chips/XP. Hydration errors already fell back to defaults in
 * the persistence layer, so the app still renders; the error is only logged.
 */
export function LoadingGate({ children }: LoadingGateProps) {
  const hasHydrated = useHydrationStore((state) => state.hasHydrated);

  if (!hasHydrated) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={styles.label}>Preparing the table…</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
  },
});
