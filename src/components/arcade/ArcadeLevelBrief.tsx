import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, fontSizes, spacing } from '../../theme';
import { ArcadeButton } from './ArcadeButton';
import { ArcadeInfoBox, ArcadePanel, ArcadePill, ArcadePlaque } from './ArcadePanel';
import { ExampleCards } from './ExampleCards';
import { StarGoals } from './StarGoals';

export interface ArcadeLevelBriefProps {
  /** "LEVEL 1", "LEVEL 3 · TRY AGAIN", "COUNT SPRINT"… */
  readonly kicker: string;
  readonly title: string;
  /** The pace pill under the plaque — "Beginner". */
  readonly difficulty?: string;
  readonly body: string;
  /** Three-star targets and their unit; omitted for intros without stars. */
  readonly starTargets?: readonly [number, number, number];
  readonly starUnit?: string;
  /** The run's rules — "3 strikes, then out", "6-deck shoe". */
  readonly rules?: readonly string[];
  readonly startLabel: string;
  readonly onStart: () => void;
  /** The "? How this level works" link; hidden when absent. */
  readonly onHow?: () => void;
  readonly howLabel?: string;
  readonly showCards?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * The Modern look's level intro: felt panel, burgundy plaque, the three
 * example cards, the description, the star goals, the rules and the big
 * gold Start — the mock-up, built from the app's own pieces.
 */
export function ArcadeLevelBrief({
  kicker,
  title,
  difficulty,
  body,
  starTargets,
  starUnit = 'right',
  rules = [],
  startLabel,
  onStart,
  onHow,
  howLabel = 'How this level works',
  showCards = true,
  style,
}: ArcadeLevelBriefProps) {
  return (
    <ArcadePanel style={[styles.panel, style]}>
      <ArcadePlaque
        kicker={kicker}
        title={title}
        footer={difficulty ? <ArcadePill label={difficulty} tone="mint" /> : undefined}
      />
      {showCards ? <ExampleCards /> : <View style={styles.cardsGap} />}
      <ArcadeInfoBox>{body}</ArcadeInfoBox>
      {starTargets ? <StarGoals targets={starTargets} unit={starUnit} /> : null}
      {rules.length > 0 ? (
        <View style={styles.rules}>
          {rules.map((rule) => (
            <ArcadePill key={rule} label={rule} />
          ))}
        </View>
      ) : null}
      <ArcadeButton
        label={startLabel}
        trailing="▶"
        size="large"
        onPress={onStart}
        style={styles.start}
      />
      {onHow ? (
        <Pressable
          onPress={onHow}
          accessibilityRole="button"
          accessibilityLabel={howLabel}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.how, pressed && styles.howPressed]}
        >
          <Ionicons name="help-circle-outline" size={20} color={colors.arcadeMuted} />
          <Text style={styles.howLabel}>{howLabel}</Text>
        </Pressable>
      ) : null}
    </ArcadePanel>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  cardsGap: {
    height: spacing.xs,
  },
  rules: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  start: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
  how: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  howPressed: {
    opacity: 0.6,
  },
  howLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.small,
    color: colors.arcadeMuted,
  },
});
