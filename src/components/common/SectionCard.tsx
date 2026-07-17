import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';

interface SectionCardProps {
  readonly title?: string;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

/** Burgundy content card with an optional gold section title. */
export function SectionCard({ title, children, style }: SectionCardProps) {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    ...shadows.card,
  },
  title: {
    color: colors.gold,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
});
