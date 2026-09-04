import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ObjectiveId, TableObjective } from '../../engine/dojo';
import { colors, fontSizes, fontWeights, radii, spacing } from '../../theme';

interface ObjectivePanelProps {
  readonly objectives: readonly TableObjective[];
  readonly completed: ReadonlySet<ObjectiveId | string>;
  readonly progress: Readonly<Record<ObjectiveId | string, number>>;
}

export function ObjectivePanel({ objectives, completed, progress }: ObjectivePanelProps) {
  if (objectives.length === 0) {
    return null;
  }
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Objectives</Text>
      {objectives.map((obj) => {
        const current = progress[obj.id] ?? 0;
        const done = completed.has(obj.id) || current >= obj.target;
        return (
          <View key={obj.id} style={[styles.row, done && styles.rowDone]}>
            <Text style={[styles.check, done && styles.checkDone]}>{done ? '✓' : '○'}</Text>
            <View style={styles.text}>
              <Text style={[styles.objectiveTitle, done && styles.textDone]}>{obj.title}</Text>
              <Text style={styles.description}>{obj.description}</Text>
            </View>
            <Text style={[styles.count, done && styles.textDone]}>
              {Math.min(current, obj.target)} / {obj.target}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    color: colors.gold,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowDone: {
    opacity: 0.7,
  },
  check: {
    color: colors.textMuted,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
    width: 24,
    textAlign: 'center',
  },
  checkDone: {
    color: colors.success,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  objectiveTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
  },
  description: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
  },
  textDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  count: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
});
