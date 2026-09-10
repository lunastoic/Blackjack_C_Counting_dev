import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { ACTION_LABELS } from '../../engine/strategy/describe';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { DeviationNotice } from '../../stores/gameSessionStore';
import { colors, fontSizes, fontWeights, layout, radii, shadows, spacing } from '../../theme';
import { TRAINING_TOGGLE_WIDTH } from './TrainingToggle';

/** How long the book play hangs on the felt. */
const TOAST_MS = 1800;

interface DeviationToastProps {
  readonly notice: DeviationNotice | null;
}

/**
 * The player just played off-book: a small pill floats on the open felt
 * between the dealer and the hand with the book play for a beat, then fades.
 * It never takes input (`pointerEvents="none"`), never covers a card or a
 * button, and the hand plays on underneath — the deal is annotated, not
 * interrupted. Mount it inside the centre-felt gap (the coach tab's rail is
 * kept clear).
 */
export function DeviationToast({ notice }: DeviationToastProps) {
  const reducedMotion = useReducedMotion();
  /** Serial of the notice whose beat has passed. */
  const [expired, setExpired] = useState<number | null>(null);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = setTimeout(() => setExpired(notice.serial), TOAST_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const shown = notice && notice.serial !== expired ? notice : null;
  if (!shown) {
    return null;
  }
  return (
    <View style={styles.slot} pointerEvents="none">
      <Animated.View
        key={shown.serial}
        style={styles.pill}
        entering={reducedMotion ? undefined : FadeInDown.duration(200)}
        exiting={reducedMotion ? undefined : FadeOutDown.duration(180)}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Book play: ${ACTION_LABELS[shown.book]}. ${shown.situation}`}
      >
        <Ionicons name="book-outline" size={14} color={colors.goldBright} />
        <View>
          <Text style={styles.title}>Book play: {ACTION_LABELS[shown.book]}</Text>
          <Text style={styles.detail}>
            {shown.situation} · you chose {ACTION_LABELS[shown.chosen]}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: TRAINING_TOGGLE_WIDTH + layout.screenPaddingH + spacing.sm,
    zIndex: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    ...shadows.overlay,
  },
  title: {
    color: colors.goldBright,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
  },
  detail: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
  },
});
