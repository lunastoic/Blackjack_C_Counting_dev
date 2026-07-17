import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
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
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { colors, radii, spacing } from '../../theme';
import { PressableScale } from '../common/PressableScale';

const ACTIONS: readonly { action: PlayerAction; image: number; label: string }[] = [
  { action: 'hit', image: appAssets.buttons.hit, label: 'Hit' },
  { action: 'stand', image: appAssets.buttons.stand, label: 'Stand' },
  { action: 'double', image: appAssets.buttons.double, label: 'Double down' },
  { action: 'split', image: appAssets.buttons.split, label: 'Split' },
];

/**
 * Hit / Stand / Double / Split using the migrated button art. In Training Mode
 * with strategy hints on, the recommended action pulses with a yellow glow.
 */
export function ActionBar() {
  const round = useGameSessionStore((state) => state.round);
  const phase = useGameSessionStore((state) => state.phase);
  const canAct = useGameSessionStore((state) => state.canAct);
  const act = useGameSessionStore((state) => state.act);
  const mode = useGameSessionStore((state) => state.mode);
  const hintsEnabled = useSettingsStore((state) => state.trainingAids.strategyHints);

  const hand = round ? activeHand(round) : null;
  const dealerUp = round?.dealerHand.cards[1];

  let recommended: PlayerAction | null = null;
  if (
    mode === 'training' &&
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
      {ACTIONS.map(({ action, image, label }) => (
        <ActionButton
          key={action}
          image={image}
          label={label}
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
  enabled,
  highlighted,
  onPress,
}: {
  image: number;
  label: string;
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
    borderColor: glow.value > 0.05 ? colors.strategyHint : 'transparent',
  }));

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
        <Image source={image} style={styles.buttonImage} resizeMode="contain" />
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
  buttonGlow: {
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: 'transparent',
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
});
