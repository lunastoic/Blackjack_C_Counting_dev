import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MAX_LEVEL, XP_PER_LEVEL } from '../../engine/progression/progression';
import { useEconomyStore } from '../../stores/economyStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { colors, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
import { PressableScale } from '../common/PressableScale';
import { ProgressBar } from '../common/ProgressBar';

const SIDE_SLOT = layout.touchTarget;
const REWARD_BTN = 28;

interface GameTableHudProps {
  readonly mapName: string;
  readonly modeLabel: string;
  readonly onOpenMaps: () => void;
  readonly onOpenSettings: () => void;
  /** When true, the ≡ control reads as the open dropdown tab. */
  readonly menuOpen?: boolean;
}

/** In-table header: globe + chips (left), map title (center), menu tab + XP (right). */
export function GameTableHud({
  mapName,
  modeLabel,
  onOpenMaps,
  onOpenSettings,
  menuOpen = false,
}: GameTableHudProps) {
  const router = useRouter();
  const chips = useEconomyStore((state) => state.chips);
  const isDailyRewardAvailable = useEconomyStore((state) => state.isDailyRewardAvailable);
  const level = useProgressionStore((state) => state.level);
  const xpIntoLevel = useProgressionStore((state) => state.xpIntoLevel);
  const atMaxLevel = level >= MAX_LEVEL;
  const xpProgress = atMaxLevel ? 1 : xpIntoLevel / XP_PER_LEVEL;

  // Tick so the claimable state flips when the cooldown ends while at the table.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const dailyReady = isDailyRewardAvailable(now);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={[styles.sideSlot, styles.sideSlotLeft]}>
          <PressableScale
            accessibilityLabel="Switch casino or mode"
            onPress={onOpenMaps}
            style={styles.globeButton}
          >
            <Ionicons name="globe-outline" size={22} color={colors.goldBright} />
          </PressableScale>
        </View>

        <View style={styles.centerColumn}>
          <Text style={styles.mapName} numberOfLines={1}>
            {mapName}
          </Text>
          <Text style={styles.modeLabel}>{modeLabel}</Text>
        </View>

        <View style={styles.sideSlot}>
          <PressableScale
            accessibilityLabel="Table settings"
            accessibilityState={{ expanded: menuOpen }}
            onPress={onOpenSettings}
            style={[styles.menuTab, menuOpen && styles.menuTabOpen]}
          >
            <Text style={styles.menuGlyph}>≡</Text>
          </PressableScale>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.chipsCluster}>
          <View style={styles.chipsPill} accessibilityLabel={`Chips: ${chips}`}>
            <Text style={styles.hudLabel}>Chips:</Text>
            <Text style={styles.hudValue}>{formatChips(chips)}</Text>
          </View>
          <PressableScale
            accessibilityLabel={
              dailyReady ? 'Daily reward available' : 'Daily rewards'
            }
            onPress={() => router.push('/rewards')}
            style={[styles.rewardButton, dailyReady && styles.rewardButtonReady]}
          >
            <Ionicons
              name="gift"
              size={15}
              color={dailyReady ? colors.textOnGold : colors.goldBright}
            />
            {dailyReady ? <View style={styles.readyDot} /> : null}
          </PressableScale>
        </View>

        <View
          style={styles.levelBlock}
          accessibilityLabel={
            atMaxLevel
              ? `Level ${level}, maximum level`
              : `Level ${level}, ${xpIntoLevel} of ${XP_PER_LEVEL} XP`
          }
        >
          <View style={styles.statRow}>
            <Text style={styles.hudLabel}>Level:</Text>
            <Text style={styles.hudValue}>{level}</Text>
          </View>
          <ProgressBar
            progress={xpProgress}
            height={10}
            accessibilityLabel={
              atMaxLevel ? 'Maximum level reached' : `${xpIntoLevel} of ${XP_PER_LEVEL} XP`
            }
            style={styles.xpBar}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 32,
  },
  sideSlot: {
    width: SIDE_SLOT,
    alignItems: 'flex-end',
  },
  sideSlotLeft: {
    alignItems: 'flex-start',
  },
  globeButton: {
    width: SIDE_SLOT,
    height: SIDE_SLOT,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  menuTab: {
    width: SIDE_SLOT,
    height: SIDE_SLOT,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.burgundy,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  menuTabOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  menuGlyph: {
    color: colors.goldBright,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.title + 4,
  },
  centerColumn: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 2,
  },
  mapName: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  modeLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.5,
  },
  /** Pill + budded reward button share one continuous gold outline. */
  chipsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    maxWidth: '58%',
  },
  chipsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
    backgroundColor: colors.overlayLight,
    borderWidth: 1.5,
    borderColor: colors.borderGold,
    borderTopLeftRadius: radii.pill,
    borderBottomLeftRadius: radii.pill,
    // Flat join into the budded reward circle.
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm + REWARD_BTN * 0.35,
    paddingVertical: spacing.xs,
    minHeight: REWARD_BTN,
  },
  rewardButton: {
    width: REWARD_BTN,
    height: REWARD_BTN,
    // Nest into the pill so gold borders read as one continuous outline.
    marginLeft: -(REWARD_BTN * 0.55),
    borderRadius: REWARD_BTN / 2,
    backgroundColor: colors.burgundy,
    borderWidth: 1.5,
    borderColor: colors.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  rewardButtonReady: {
    backgroundColor: colors.goldBright,
    borderColor: colors.gold,
  },
  readyDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.burgundy,
    borderWidth: 1,
    borderColor: colors.goldBright,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  hudLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
  },
  hudValue: {
    color: colors.goldBright,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    fontVariant: ['tabular-nums'],
  },
  levelBlock: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    flexShrink: 0,
    minWidth: 112,
  },
  xpBar: {
    width: '100%',
  },
});
