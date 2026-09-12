import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
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
  /**
   * Fill the room the parent gives and shrink the panel to fit it, so the
   * brief is always one page — it never scrolls. The parent sizes the room.
   */
  readonly fit?: boolean;
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
  fit = false,
  style,
}: ArcadeLevelBriefProps) {
  // Both measures come from layout, which ignores the scale transform, so
  // shrinking the panel never re-measures it.
  const [room, setRoom] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState(0);
  const measureRoom = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setRoom({ width, height });
  }, []);
  // The panel's height is taken once, at the room's width. A shrunk panel is
  // laid out wider (room ÷ scale) so it still spans the room after the
  // transform; that re-wraps the copy shorter, and re-deriving the scale
  // from the new height would only chase it round.
  const measurePanel = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setNatural((first) => first || height);
  }, []);
  const measured = room.height > 0 && natural > 0;
  const scale = fit && measured ? Math.min(1, room.height / natural) : 1;

  const panel = (
    <ArcadePanel
      style={[
        styles.panel,
        // Hidden until both measures are in, so it never flashes at full size.
        fit && { transform: [{ scale }], opacity: measured ? 1 : 0 },
        fit && scale < 1 && { alignSelf: 'center', width: room.width / scale },
        style,
      ]}
      onLayout={fit ? measurePanel : undefined}
    >
      <ArcadePlaque
        kicker={kicker}
        title={title}
        footer={difficulty ? <ArcadePill label={difficulty} tone="mint" /> : undefined}
      />
      {showCards ? <ExampleCards cardWidth={54} /> : <View style={styles.cardsGap} />}
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

  if (!fit) {
    return panel;
  }
  // The room is a flex box, so its height is what the parent leaves — the
  // panel overflowing it (before the shrink) never stretches it.
  return (
    <View style={styles.room} onLayout={measureRoom}>
      {panel}
    </View>
  );
}

const styles = StyleSheet.create({
  room: {
    flex: 1,
    justifyContent: 'center',
  },
  panel: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm + spacing.xxs,
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
  },
  how: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
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
