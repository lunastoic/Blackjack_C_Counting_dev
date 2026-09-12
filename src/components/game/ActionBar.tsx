import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { appAssets } from '../../assets/registry';
import { PlayerAction } from '../../engine/blackjack/rules';
import { activeHand } from '../../engine/blackjack/round';
import { recommendForHand } from '../../engine/strategy/recommend';
import { useModernUi } from '../../hooks/useModernUi';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { colors, radii, spacing } from '../../theme';
import { countCoachCapabilities, effectiveCountCoachLevel, effectiveTrainingAids } from '../../utils/countCoach';
import { ArcadeButton, ArcadeButtonVariant } from '../arcade/ArcadeButton';
import { PressableScale } from '../common/PressableScale';

const ACTIONS: readonly {
  action: PlayerAction;
  image: number;
  label: string;
  /** The Modern bevel's colour — the same hue the Classic art has. */
  variant: ArcadeButtonVariant;
  /** Short enough for four bevels in a row. */
  shortLabel: string;
}[] = [
  { action: 'hit', image: appAssets.buttons.hit, label: 'Hit', variant: 'green', shortLabel: 'Hit' },
  { action: 'stand', image: appAssets.buttons.stand, label: 'Stand', variant: 'red', shortLabel: 'Stand' },
  {
    action: 'double',
    image: appAssets.buttons.double,
    label: 'Double down',
    variant: 'orange',
    shortLabel: 'Double',
  },
  { action: 'split', image: appAssets.buttons.split, label: 'Split', variant: 'blue', shortLabel: 'Split' },
];

/**
 * Hit / Stand / Double / Split. Classic uses the migrated button art; Modern
 * draws the same colours as arcade bevels. With Training Mode on (Full coach)
 * and strategy hints on, the recommended action pulses with a yellow glow.
 */
export function ActionBar() {
  const modern = useModernUi();
  const round = useGameSessionStore((state) => state.round);
  const phase = useGameSessionStore((state) => state.phase);
  const canAct = useGameSessionStore((state) => state.canAct);
  const act = useGameSessionStore((state) => state.act);
  const hintsEnabled = useSettingsStore(
    (state) =>
      effectiveTrainingAids(state.trainingAids).strategyHints &&
      countCoachCapabilities(effectiveCountCoachLevel(state.countCoachLevel, state.trainingMode))
        .allowFullTools,
  );

  const hand = round ? activeHand(round) : null;
  const dealerUp = round?.dealerHand.cards[1];

  let recommended: PlayerAction | null = null;
  if (
    hintsEnabled &&
    phase === 'playerTurn' &&
    hand &&
    dealerUp
  ) {
    recommended = recommendForHand(hand, dealerUp.rank, {
      canDouble: canAct('double'),
      canSplit: canAct('split'),
    }).preferredAction;
  }

  return (
    <View style={styles.bar}>
      {ACTIONS.map(({ action, image, label, variant, shortLabel }) => (
        <ActionButton
          key={action}
          image={image}
          label={label}
          modern={modern ? { variant, shortLabel } : undefined}
          enabled={phase === 'playerTurn' && canAct(action)}
          highlighted={recommended === action}
          onPress={() => {
            if (act(action)) {
              playSound('buttonTap');
              void haptics.lightTap();
            }
          }}
        />
      ))}
    </View>
  );
}

function ActionButton({
  image,
  label,
  modern,
  enabled,
  highlighted,
  onPress,
}: {
  image: number;
  label: string;
  /** Set for the Modern look: the bevel replaces the art. */
  modern?: { variant: ArcadeButtonVariant; shortLabel: string };
  enabled: boolean;
  highlighted: boolean;
  onPress: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const glow = useSharedValue(0);

  useEffect(() => {
    if (highlighted && !reducedMotion) {
      glow.value = withRepeat(
        withSequence(withTiming(1, { duration: 550 }), withTiming(0.35, { duration: 550 })),
        -1,
        true,
      );
    } else {
      cancelAnimation(glow);
      glow.value = withTiming(highlighted ? 1 : 0, { duration: 200 });
    }
    return () => cancelAnimation(glow);
  }, [highlighted, reducedMotion, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glow.value,
  }));

  if (modern) {
    return (
      <Animated.View style={[styles.buttonGlow, glowStyle]}>
        <ArcadeButton
          label={modern.shortLabel}
          accessibilityLabel={label}
          accessibilityHint={highlighted ? 'Recommended by basic strategy' : undefined}
          variant={modern.variant}
          size="small"
          disabled={!enabled}
          // The tap is already the haptic; ActionBar fires it when the action lands.
          hapticFeedback={false}
          onPress={onPress}
          style={styles.arcadeButton}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.buttonGlow, glowStyle]}>
      <PressableScale
        onPress={onPress}
        disabled={!enabled}
        accessibilityLabel={label}
        accessibilityState={{ disabled: !enabled }}
        accessibilityHint={highlighted ? 'Recommended by basic strategy' : undefined}
        style={[styles.button, !enabled && styles.buttonDisabled]}
      >
        <Image source={image} style={styles.buttonImage} contentFit="contain" />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Soft halo only for the recommended action — no outline.
  buttonGlow: {
    borderRadius: radii.md,
    shadowColor: colors.strategyHint,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonImage: {
    width: 82,
    height: 46,
  },
  /** Same footprint as the art, so the bar keeps its rhythm across looks. */
  arcadeButton: {
    width: 84,
  },
});
