import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { playSound } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { useAchievementStore } from '../../stores/achievementStore';
import { LevelUpNotice, useGameSessionStore } from '../../stores/gameSessionStore';
import { colors, fontSizes, fontWeights, layers, radii, shadows, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
import { PressableScale } from '../common/PressableScale';

const TOAST_MS = 3200;

interface GameToastsProps {
  /** Level-up source; defaults to the blackjack game session store. */
  levelUpNotice?: LevelUpNotice | null;
  onDismissLevelUp?: () => void;
}

/** Level-up and achievement-unlock toasts stacked at the top of the screen. */
export function GameToasts({ levelUpNotice, onDismissLevelUp }: GameToastsProps = {}) {
  const sessionLevelUp = useGameSessionStore((state) => state.levelUpNotice);
  const sessionDismiss = useGameSessionStore((state) => state.dismissLevelUp);
  const levelUp = levelUpNotice !== undefined ? levelUpNotice : sessionLevelUp;
  const dismissLevelUp = onDismissLevelUp ?? sessionDismiss;
  const pendingUnlocks = useAchievementStore((state) => state.pendingUnlocks);
  const dismissUnlock = useAchievementStore((state) => state.dismissUnlock);
  const reducedMotion = useReducedMotion();

  const unlock = pendingUnlocks[0] ?? null;

  useEffect(() => {
    if (!levelUp) {
      return;
    }
    playSound('levelUp');
    void haptics.success();
    const timer = setTimeout(dismissLevelUp, TOAST_MS);
    return () => clearTimeout(timer);
  }, [levelUp, dismissLevelUp]);

  useEffect(() => {
    if (!unlock) {
      return;
    }
    playSound('achievementUnlock');
    void haptics.success();
    const timer = setTimeout(() => dismissUnlock(unlock.achievementId), TOAST_MS);
    return () => clearTimeout(timer);
  }, [unlock, dismissUnlock]);

  if (!levelUp && !unlock) {
    return null;
  }

  return (
    <View style={styles.stack} pointerEvents="box-none">
      {levelUp ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(250)}
          exiting={reducedMotion ? undefined : FadeOutUp.duration(200)}
        >
          <PressableScale onPress={dismissLevelUp} accessibilityLabel="Dismiss level up" style={styles.toast}>
            <Text style={styles.title}>Level {levelUp.level} reached!</Text>
            <Text style={styles.subtitle}>+{formatChips(levelUp.chipReward)} chips</Text>
          </PressableScale>
        </Animated.View>
      ) : null}
      {unlock ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(250)}
          exiting={reducedMotion ? undefined : FadeOutUp.duration(200)}
        >
          <PressableScale
            onPress={() => dismissUnlock(unlock.achievementId)}
            accessibilityLabel="Dismiss achievement"
            style={[styles.toast, styles.achievementToast]}
          >
            <Text style={styles.title}>Achievement: {unlock.title}</Text>
            <Text style={styles.subtitle}>{unlock.description}</Text>
          </PressableScale>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.sm,
    zIndex: layers.toast,
  },
  toast: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
    ...shadows.overlay,
  },
  achievementToast: {
    borderColor: colors.success,
  },
  title: {
    color: colors.goldBright,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
  },
});
