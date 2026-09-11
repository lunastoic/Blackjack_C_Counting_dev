import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { ACTION_LABELS } from '../../engine/strategy/describe';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { DeviationNotice } from '../../stores/gameSessionStore';
import { colors, fontSizes, fontWeights, radii, shadows, spacing } from '../../theme';

/** How long the book play hangs on the felt before it fades on its own. */
const TOAST_MS = 4000;
const CLOSE_SIZE = 22;

interface DeviationToastProps {
  readonly notice: DeviationNotice | null;
  /** Clears the notice — the timer and the × both land here. */
  readonly onDismiss: () => void;
}

/**
 * The player just played off-book: a pill floats just above the action
 * buttons with the book play, long enough to read, with an × to send it off
 * sooner. It hangs off the top of the bottom panel so it never moves a
 * button under a finger, and the hand plays on — the deal is annotated, not
 * interrupted. Only the × takes touches; everything else falls through.
 * Mount it inside the bottom panel (the felt's centre gap is too short for
 * two lines once a hand is out).
 */
export function DeviationToast({ notice, onDismiss }: DeviationToastProps) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) {
    return null;
  }
  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <View style={styles.slot} pointerEvents="box-none">
        <Animated.View
          key={notice.serial}
          style={styles.pill}
          pointerEvents="box-none"
          entering={reducedMotion ? undefined : FadeInDown.duration(200)}
          exiting={reducedMotion ? undefined : FadeOutDown.duration(180)}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Book play: ${ACTION_LABELS[notice.book]}. ${notice.situation}`}
        >
          <Ionicons name="book-outline" size={14} color={colors.goldBright} />
          <View style={styles.copy}>
            <Text style={styles.title}>Book play: {ACTION_LABELS[notice.book]}</Text>
            <Text style={styles.detail}>
              {notice.situation} · you chose {ACTION_LABELS[notice.chosen]}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.close,
              pressed && styles.closePressed,
            ]}
            onPress={onDismiss}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Ionicons name="close" size={14} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * A zero-height line on the panel's top edge; the slot hangs off its
   * bottom, so the pill reaches up over the felt without a measured height.
   */
  anchor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0,
    zIndex: 20,
  },
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: spacing.xxs,
  },
  pill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    ...shadows.overlay,
  },
  /** Shrinks to the pill so the lines wrap inside it instead of running out. */
  copy: {
    flexShrink: 1,
  },
  title: {
    color: colors.goldBright,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.bold,
  },
  detail: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: fontSizes.caption + 4,
  },
  close: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: CLOSE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  closePressed: {
    opacity: 0.6,
  },
});
