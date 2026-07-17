import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Switch, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { GameMode } from '../../engine/blackjack/rules';
import { COUNT_COACH_LEVELS, CountCoachLevel } from '../../engine/types';
import { DECK_COUNTS } from '../../engine/shoe/shoe';
import { clampDealerSpeed } from '../../stores/settingsStore';
import { colors, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';
import { COUNT_COACH_BLURBS, COUNT_COACH_LABELS } from '../../utils/countCoach';
import { IconButton } from '../common/IconButton';
import { PressableScale } from '../common/PressableScale';

/** Shared, store-agnostic settings controls used by the Settings screen and the in-game sheet. */

export function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surfaceRaised, true: colors.goldDim }}
        thumbColor={value ? colors.gold : colors.textMuted}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function DealerSpeedStepper({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <IconButton
        glyph="−"
        accessibilityLabel="Slower dealer"
        disabled={value <= min}
        onPress={() => onChange(value - step)}
      />
      <Text style={styles.stepperValue}>{value.toFixed(2)}×</Text>
      <IconButton
        glyph="+"
        accessibilityLabel="Faster dealer"
        disabled={value >= max}
        onPress={() => onChange(value + step)}
      />
    </View>
  );
}

const SPEED_SLIDER_THUMB = 22;

/** Horizontal speed slider (0.5×–2.0×) for live autoplay pacing. */
export function SpeedSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);

  const snapSpeed = useCallback(
    (ratio: number) => {
      const clamped = Math.min(1, Math.max(0, ratio));
      const raw = min + clamped * (max - min);
      const steps = Math.round((raw - min) / step);
      onChange(clampDealerSpeed(min + steps * step));
    },
    [max, min, onChange, step],
  );

  const setFromX = useCallback(
    (x: number) => {
      if (trackWidth <= 0) {
        return;
      }
      snapSpeed(x / trackWidth);
    },
    [snapSpeed, trackWidth],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .onBegin((event) => {
      runOnJS(setFromX)(event.x);
    })
    .onUpdate((event) => {
      runOnJS(setFromX)(event.x);
    });

  function handleTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  const ratio = (value - min) / (max - min);
  const thumbLeft =
    trackWidth > 0
      ? Math.max(0, Math.min(trackWidth - SPEED_SLIDER_THUMB, ratio * trackWidth - SPEED_SLIDER_THUMB / 2))
      : 0;

  return (
    <View style={styles.speedSliderBlock} accessibilityLabel={`${label}, ${value.toFixed(2)} times speed`}>
      <View style={styles.speedSliderHeader}>
        <Text style={styles.speedSliderLabel}>{label}</Text>
        <Text style={styles.speedSliderValue}>{value.toFixed(2)}×</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.speedSliderTrack} onLayout={handleTrackLayout}>
          <View style={[styles.speedSliderFill, { width: `${ratio * 100}%` }]} />
          <View
            style={[
              styles.speedSliderThumb,
              trackWidth > 0 ? { left: thumbLeft } : { left: '50%', marginLeft: -SPEED_SLIDER_THUMB / 2 },
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

export function DeckCountRow({
  label,
  mode,
  selected,
  onSelect,
}: {
  label: string;
  mode: GameMode;
  selected: number;
  onSelect: (mode: GameMode, count: number) => void;
}) {
  return (
    <View style={styles.deckRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={styles.deckOptions}>
        {DECK_COUNTS.map((count) => {
          const active = selected === count;
          return (
            <PressableScale
              key={count}
              onPress={() => onSelect(mode, count)}
              accessibilityLabel={`${label}: ${count} ${count === 1 ? 'deck' : 'decks'}`}
              accessibilityState={{ selected: active }}
              style={[styles.deckOption, active && styles.deckOptionActive]}
            >
              <Text style={[styles.deckOptionText, active && styles.deckOptionTextActive]}>
                {count}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/** Count Coach: Off / Learn / Full. */
export function CountCoachRow({
  selected,
  onSelect,
}: {
  selected: CountCoachLevel;
  onSelect: (level: CountCoachLevel) => void;
}) {
  return (
    <View style={styles.deckRow}>
      <Text style={styles.toggleLabel}>Count Coach</Text>
      <View style={styles.deckOptions}>
        {COUNT_COACH_LEVELS.map((level) => {
          const active = selected === level;
          return (
            <PressableScale
              key={level}
              onPress={() => onSelect(level)}
              accessibilityLabel={`Count Coach: ${COUNT_COACH_LABELS[level]}`}
              accessibilityState={{ selected: active }}
              style={[styles.deckOption, active && styles.deckOptionActive]}
            >
              <Text style={[styles.coachOptionText, active && styles.deckOptionTextActive]}>
                {COUNT_COACH_LABELS[level]}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <Text style={styles.coachBlurb}>{COUNT_COACH_BLURBS[selected]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    flexShrink: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  stepperValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  speedSliderBlock: {
    width: '100%',
    gap: spacing.xs,
  },
  speedSliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speedSliderLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
  },
  speedSliderValue: {
    color: colors.goldBright,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  speedSliderTrack: {
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderGold,
    justifyContent: 'center',
    overflow: 'visible',
  },
  speedSliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radii.pill,
    backgroundColor: colors.goldDim,
  },
  speedSliderThumb: {
    position: 'absolute',
    width: SPEED_SLIDER_THUMB,
    height: SPEED_SLIDER_THUMB,
    marginTop: (28 - SPEED_SLIDER_THUMB) / 2,
    borderRadius: SPEED_SLIDER_THUMB / 2,
    backgroundColor: colors.goldBright,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  deckRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  deckOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deckOption: {
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckOptionActive: {
    backgroundColor: colors.burgundy,
    borderColor: colors.gold,
  },
  deckOptionText: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  deckOptionTextActive: {
    color: colors.textPrimary,
  },
  coachOptionText: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
  },
  coachBlurb: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    lineHeight: fontSizes.caption + 4,
  },
});
