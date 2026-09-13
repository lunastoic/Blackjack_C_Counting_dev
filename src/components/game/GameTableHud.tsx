import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MAX_LEVEL, XP_PER_LEVEL } from '../../engine/progression/progression';
import { useDailyGoalStore } from '../../stores/dailyGoalStore';
import { useEconomyStore } from '../../stores/economyStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useModernUi } from '../../hooks/useModernUi';
import { colors, fonts, fontSizes, fontWeights, layout, radii, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
import { ArcadeBar, ArcadeBevel, ArcadeMarquee, ArcadeSquare, arcadeShadow } from '../arcade';
import { PressableScale } from '../common/PressableScale';
import { ProgressBar } from '../common/ProgressBar';

const SIDE_SLOT = layout.touchTarget;
const REWARD_BTN = 28;
/** The Modern gift bud: a plaque square nested into the chips pill. */
const MODERN_BUD = 34;

interface GameTableHudProps {
  readonly mapName: string;
  readonly modeLabel: string;
  readonly onOpenMaps: () => void;
  readonly onOpenSettings: () => void;
  /** When true, the ≡ control reads as the open dropdown tab. */
  readonly menuOpen?: boolean;
  /** Likewise the left control, while the Modern level menu hangs from it. */
  readonly mapOpen?: boolean;
  /** Left control glyph — globe for casinos, map for the level ladder. */
  readonly leftIcon?: React.ComponentProps<typeof Ionicons>['name'];
  readonly leftAccessibilityLabel?: string;
}

/** In-table header: globe + chips (left), map title (center), menu tab + XP (right). */
export function GameTableHud({
  mapName,
  modeLabel,
  onOpenMaps,
  onOpenSettings,
  menuOpen = false,
  mapOpen = false,
  leftIcon = 'globe-outline',
  leftAccessibilityLabel = 'Switch casino or mode',
}: GameTableHudProps) {
  const router = useRouter();
  const chips = useEconomyStore((state) => state.chips);
  const isDailyRewardAvailable = useEconomyStore((state) => state.isDailyRewardAvailable);
  // Subscribing to the fields (not just the getter) re-renders when a hand tips the goal over.
  useDailyGoalStore((state) => state.progress);
  useDailyGoalStore((state) => state.lastClaimedDayKey);
  const isGoalClaimable = useDailyGoalStore((state) => state.isClaimable);
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
  const dailyReady = isDailyRewardAvailable(now) || isGoalClaimable(now);
  const modern = useModernUi();

  if (modern) {
    return (
      <View style={styles.container}>
        <View style={styles.topRow}>
          <ArcadeSquare
            onPress={onOpenMaps}
            open={mapOpen}
            accessibilityLabel={leftAccessibilityLabel}
            accessibilityState={{ expanded: mapOpen }}
          >
            <Ionicons name={leftIcon} size={22} color={colors.arcadeGold} />
          </ArcadeSquare>
          <ArcadeMarquee title={mapName} subtitle={modeLabel} style={styles.marquee} />
          <ArcadeSquare
            onPress={onOpenSettings}
            tone="plaque"
            open={menuOpen}
            accessibilityLabel="Table settings"
            accessibilityState={{ expanded: menuOpen }}
          >
            <Ionicons name="menu" size={26} color={colors.arcadeGold} />
          </ArcadeSquare>
        </View>

        <View style={styles.bottomRow}>
          <View style={[styles.chipsCluster, styles.modernChipsCluster]}>
            <ArcadeBevel
              face={colors.arcadeStripFace}
              deep={colors.arcadeStripDeep}
              drop={3}
              outline={2}
              band={3}
              radius={10}
              style={styles.modernChipsPill}
              faceStyle={styles.modernChipsFace}
            >
              <View style={styles.modernChipsRow} accessibilityLabel={`Chips: ${chips}`}>
                <Text style={styles.modernLabel}>CHIPS:</Text>
                <Text style={styles.modernValue} numberOfLines={1}>
                  {formatChips(chips)}
                </Text>
              </View>
            </ArcadeBevel>
            <PressableScale
              accessibilityLabel={dailyReady ? 'Daily reward available' : 'Daily rewards'}
              onPress={() => router.push('/rewards')}
              style={styles.modernBud}
            >
              <ArcadeBevel
                face={dailyReady ? colors.arcadeGold : colors.arcadePlaque}
                deep={dailyReady ? colors.arcadeGoldDeep : colors.arcadePlaqueDeep}
                drop={3}
                outline={2}
                band={3}
                radius={10}
                faceStyle={styles.modernBudFace}
              >
                <Ionicons
                  name="gift"
                  size={16}
                  color={dailyReady ? colors.arcadeInkOnLight : colors.arcadeGold}
                />
              </ArcadeBevel>
              {dailyReady ? <View style={styles.modernReadyDot} /> : null}
            </PressableScale>
          </View>

          <View
            style={[styles.levelBlock, styles.modernLevelBlock]}
            accessibilityLabel={
              atMaxLevel
                ? `Level ${level}, maximum level`
                : `Level ${level}, ${xpIntoLevel} of ${XP_PER_LEVEL} XP`
            }
          >
            <View style={styles.statRow}>
              <Text style={styles.modernLabel}>LEVEL:</Text>
              <Text style={styles.modernValue}>{level}</Text>
            </View>
            <ArcadeBar
              progress={xpProgress}
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

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={[styles.sideSlot, styles.sideSlotLeft]}>
          <PressableScale
            accessibilityLabel={leftAccessibilityLabel}
            onPress={onOpenMaps}
            style={styles.globeButton}
          >
            <Ionicons name={leftIcon} size={22} color={colors.goldBright} />
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
  /* Modern */
  marquee: {
    flex: 1,
    minWidth: 0,
  },
  modernChipsCluster: {
    alignItems: 'flex-end',
    marginBottom: 3,
  },
  modernChipsPill: {
    flexShrink: 1,
    minWidth: 0,
  },
  modernChipsFace: {
    borderRightWidth: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    minHeight: 30,
    paddingTop: 1,
    paddingBottom: 3,
    paddingLeft: spacing.sm + spacing.xxs,
    paddingRight: spacing.xl - 2,
    justifyContent: 'center',
  },
  modernChipsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  modernLabel: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 18,
    letterSpacing: 1,
    color: colors.arcadeGold,
    includeFontPadding: false,
    ...arcadeShadow.soft,
  },
  modernValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 22,
    color: colors.arcadeCream,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    ...arcadeShadow.deep,
  },
  modernBud: {
    width: MODERN_BUD,
    marginLeft: -14,
    zIndex: 1,
  },
  modernBudFace: {
    height: MODERN_BUD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  modernReadyDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.arcadeRed,
    borderWidth: 2,
    borderColor: colors.arcadeInk,
  },
  modernLevelBlock: {
    gap: 3,
    marginBottom: 3,
  },
});
