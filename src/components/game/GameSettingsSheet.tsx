import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mapById } from '../../engine/betting/casino';
import { progressFor } from '../../engine/achievements/engine';
import { achievementsForMap } from '../../engine/achievements/mapDefinitions';
import { INITIAL_STATS } from '../../engine/achievements/stats';
import { useAchievementStore } from '../../stores/achievementStore';
import {
  debugCompleteAllMaps,
  debugCompleteMap,
  debugCompleteNextLevel,
  debugResetLevels,
  debugResetMaps,
  debugUnlockAllMaps,
  FLASH_DEBUG_AVAILABLE,
  useFlashDebugStore,
} from '../../stores/flashDebugStore';
import { useGameSessionStore } from '../../stores/gameSessionStore';
import {
  DEALER_SPEED_MAX,
  DEALER_SPEED_MIN,
  DEALER_SPEED_STEP,
  useSettingsStore,
} from '../../stores/settingsStore';
import {
  colors,
  fontSizes,
  fontWeights,
  layout,
  radii,
  shadows,
  spacing,
} from '../../theme';
import { FEATURES } from '../../constants/features';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { Divider } from '../common/Divider';
import { PressableScale } from '../common/PressableScale';
import { ProgressBar } from '../common/ProgressBar';
import {
  CountCoachRow,
  DealerSpeedStepper,
  ToggleRow,
} from '../settings/SettingsRows';

const TAB_SIZE = layout.touchTarget;
const MENU_WIDTH = 380;

type MenuTab = 'achievements' | 'training' | 'settings';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: readonly { key: MenuTab; label: string; icon: IoniconName }[] = [
  { key: 'achievements', label: 'Achievements', icon: 'trophy' },
  { key: 'training', label: 'Training', icon: 'school' },
  { key: 'settings', label: 'Settings', icon: 'settings-sharp' },
];

/** In-game dropdown that hangs from the top-right ≡ tab: achievements, training aids, settings. */
export function GameSettingsSheet({
  visible,
  onClose,
  mapId,
}: {
  visible: boolean;
  onClose: () => void;
  /** Casino whose achievements fill the first tab. */
  mapId: number;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [tab, setTab] = useState<MenuTab>('achievements');

  function goTo(href: Href) {
    onClose();
    router.push(href);
  }

  const anchorTop = insets.top + spacing.sm;
  const panelMaxHeight = windowHeight - anchorTop - TAB_SIZE - insets.bottom - spacing.xl;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'fade' : 'fade'}
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close menu"
          accessibilityRole="button"
        />

        <View
          style={[
            styles.anchor,
            {
              top: anchorTop,
              right: layout.screenPaddingH,
              width: Math.min(MENU_WIDTH, windowWidth - layout.screenPaddingH * 2),
            },
          ]}
        >
          {/* Tab tip — aligns with the HUD ≡ so the menu reads as dropping from it. */}
          <PressableScale
            accessibilityLabel="Close menu"
            onPress={onClose}
            style={styles.tab}
          >
            <Text style={styles.tabGlyph}>≡</Text>
          </PressableScale>

          <View style={[styles.panel, { maxHeight: panelMaxHeight }]}>
            <View style={styles.tabBar} accessibilityRole="tablist">
              {TABS.map((item) => {
                const active = item.key === tab;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setTab(item.key)}
                    accessibilityRole="tab"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: active }}
                    style={[styles.tabButton, active && styles.tabButtonActive]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={active ? colors.goldBright : colors.textSecondary}
                    />
                    <Text
                      style={[styles.tabLabel, active && styles.tabLabelActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {tab === 'achievements' ? <AchievementsTab mapId={mapId} /> : null}
              {tab === 'training' ? <TrainingTab onNavigate={goTo} /> : null}
              {tab === 'settings' ? <SettingsTab mapId={mapId} onNavigate={goTo} /> : null}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AchievementsTab({ mapId }: { mapId: number }) {
  // Derive from the subscribed slice so the list refreshes the moment an unlock lands.
  const slice = useAchievementStore((state) => state.mapSlices[mapId]);
  const list = useMemo(() => {
    const context = {
      stats: slice?.stats ?? INITIAL_STATS,
      unlockedIds: slice?.unlockedIds ?? [],
    };
    return achievementsForMap(mapId).map((definition) => ({
      definition,
      progress: progressFor(definition, context),
    }));
  }, [slice, mapId]);
  const unlocked = list.filter((item) => item.progress.unlocked).length;

  return (
    <>
      <Text style={styles.tabSummary}>
        {unlocked} of {list.length} unlocked at this table
      </Text>
      {list.map(({ definition, progress }) => (
        <View
          key={definition.id}
          style={[styles.card, styles.achievementCard, progress.unlocked && styles.achievementCardDone]}
        >
          <View style={styles.trophySlot}>
            <Ionicons
              name={progress.unlocked ? 'trophy' : 'trophy-outline'}
              size={28}
              color={progress.unlocked ? colors.goldBright : colors.textMuted}
            />
          </View>
          <View style={styles.achievementBody}>
            <Text
              style={[styles.achievementTitle, progress.unlocked && styles.achievementTitleDone]}
              numberOfLines={1}
            >
              {definition.title}
            </Text>
            <Text style={styles.achievementDescription} numberOfLines={2}>
              {definition.description}
            </Text>
            <ProgressBar
              progress={progress.goal > 0 ? progress.current / progress.goal : 0}
              height={8}
              fillColor={progress.unlocked ? colors.success : colors.gold}
              trackColor={colors.surfaceRaised}
              accessibilityLabel={`${progress.current} of ${progress.goal}`}
              style={styles.achievementBar}
            />
            <Text style={[styles.achievementCount, progress.unlocked && styles.achievementCountDone]}>
              {progress.current}/{progress.goal}
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}

function TrainingTab({ onNavigate }: { onNavigate: (href: Href) => void }) {
  const settings = useSettingsStore();
  return (
    <>
      {FEATURES.countCoachDial ? (
        <View style={styles.card}>
          <CountCoachRow
            selected={settings.countCoachLevel}
            onSelect={settings.setCountCoachLevel}
          />
        </View>
      ) : null}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Training mode</Text>
        <ToggleRow
          label="Training mode"
          value={settings.trainingMode}
          onChange={settings.setTrainingMode}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Training aids</Text>
        <ToggleRow
          label="Card underglow"
          value={settings.trainingAids.cardUnderglow}
          onChange={(v) => settings.setTrainingAid('cardUnderglow', v)}
        />
        <Divider />
        <ToggleRow
          label="Strategy hints"
          value={settings.trainingAids.strategyHints}
          onChange={(v) => settings.setTrainingAid('strategyHints', v)}
        />
        <Divider />
        <ToggleRow
          label="Count pulse"
          value={settings.trainingAids.countPulse}
          onChange={(v) => settings.setTrainingAid('countPulse', v)}
        />
        <Divider />
        <ToggleRow
          label="Distribution charts"
          value={settings.trainingAids.distributionCharts}
          onChange={(v) => settings.setTrainingAid('distributionCharts', v)}
        />
      </View>
      <View style={styles.card}>
        <LinkRow label="How to Play" icon="book-outline" onPress={() => onNavigate('/how-to-play')} />
      </View>
    </>
  );
}

function SettingsTab({ mapId, onNavigate }: { mapId: number; onNavigate: (href: Href) => void }) {
  const settings = useSettingsStore();
  const deckCount = useGameSessionStore((state) => state.map?.deckCount ?? 6);
  return (
    <>
      <View style={styles.card}>
        <ToggleRow
          label="Sound"
          value={settings.soundEnabled}
          onChange={settings.setSoundEnabled}
        />
        <Divider />
        <ToggleRow
          label="Haptics"
          value={settings.hapticsEnabled}
          onChange={settings.setHapticsEnabled}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Dealer speed</Text>
        <DealerSpeedStepper
          value={settings.dealerSpeed}
          min={DEALER_SPEED_MIN}
          max={DEALER_SPEED_MAX}
          step={DEALER_SPEED_STEP}
          onChange={settings.setDealerSpeed}
        />
        <Text style={styles.note}>
          This casino deals a {deckCount}-deck shoe at 88% penetration — decks are set by
          the house, not the settings.
        </Text>
      </View>
      <View style={styles.card}>
        <LinkRow label="Profile" icon="person-outline" onPress={() => onNavigate('/profile')} />
        <Divider />
        <LinkRow label="Rewards" icon="gift-outline" onPress={() => onNavigate('/rewards')} />
        <Divider />
        <LinkRow
          label="Statistics"
          icon="stats-chart-outline"
          onPress={() => onNavigate('/achievements')}
        />
        <Divider />
        <LinkRow
          label="Player Settings"
          icon="options-outline"
          onPress={() => onNavigate('/settings')}
        />
      </View>
      {FLASH_DEBUG_AVAILABLE ? <DebugCard mapId={mapId} /> : null}
    </>
  );
}

/** DEV-ONLY: level and map progress shortcuts for testing. Remove before release. */
function DebugCard({ mapId }: { mapId: number }) {
  const unlockAll = useFlashDebugStore((state) => state.unlockAll);
  const setUnlockAll = useFlashDebugStore((state) => state.setUnlockAll);
  const mapName = mapById(mapId)?.name ?? 'this casino';
  return (
    <View style={[styles.card, styles.debugCard]}>
      <Text style={[styles.sectionLabel, styles.debugLabel]}>Debug · dev builds only</Text>
      <ToggleRow label="Preview everything unlocked" value={unlockAll} onChange={setUnlockAll} />
      <Divider />
      <Text style={styles.debugGroup}>Levels · {mapName}</Text>
      <View style={styles.debugRow}>
        <DebugButton label="+1 level" onPress={() => debugCompleteNextLevel(mapId)} />
        <DebugButton label="Clear ladder" onPress={() => debugCompleteMap(mapId)} />
      </View>
      <Text style={styles.debugGroup}>Levels · all casinos</Text>
      <View style={styles.debugRow}>
        <DebugButton label="Clear every ladder" onPress={debugCompleteAllMaps} />
        <DebugButton label="Reset levels" onPress={debugResetLevels} destructive />
      </View>
      <Text style={styles.debugGroup}>Maps</Text>
      <View style={styles.debugRow}>
        <DebugButton label="Unlock all maps" onPress={debugUnlockAllMaps} />
        <DebugButton label="Reset maps" onPress={debugResetMaps} destructive />
      </View>
    </View>
  );
}

function DebugButton({
  label,
  onPress,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <PressableScale
      style={[styles.debugButton, destructive && styles.debugButtonDestructive]}
      onPress={onPress}
      accessibilityLabel={label}
    >
      <Text style={[styles.debugButtonText, destructive && styles.debugButtonTextDestructive]}>
        {label}
      </Text>
    </PressableScale>
  );
}

function LinkRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IoniconName;
  onPress: () => void;
}) {
  return (
    <PressableScale style={styles.linkRow} onPress={onPress} accessibilityLabel={label}>
      <Ionicons name={icon} size={18} color={colors.goldBright} />
      <Text style={styles.linkText}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  anchor: {
    position: 'absolute',
    alignItems: 'flex-end',
    ...shadows.overlay,
  },
  tab: {
    width: TAB_SIZE,
    height: TAB_SIZE,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: colors.burgundy,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tabGlyph: {
    color: colors.goldBright,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.title + 4,
  },
  panel: {
    width: '100%',
    marginTop: -1,
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: radii.lg,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    borderTopRightRadius: 0,
    borderWidth: 1,
    borderColor: colors.borderGold,
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.burgundyDeep,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGold,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    backgroundColor: colors.burgundy,
    borderBottomColor: colors.goldBright,
  },
  tabLabel: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
  },
  tabLabelActive: {
    color: colors.goldBright,
    fontWeight: fontWeights.bold,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  tabSummary: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.5,
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  achievementCardDone: {
    borderColor: colors.borderGold,
  },
  trophySlot: {
    width: 40,
    alignItems: 'center',
  },
  achievementBody: {
    flex: 1,
    gap: spacing.xs,
  },
  achievementTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  achievementTitleDone: {
    color: colors.goldBright,
  },
  achievementDescription: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
  },
  achievementBar: {
    marginTop: spacing.xxs,
  },
  achievementCount: {
    color: colors.gold,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    fontVariant: ['tabular-nums'],
  },
  achievementCountDone: {
    color: colors.success,
  },
  sectionLabel: {
    color: colors.goldBright,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  note: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  debugCard: {
    borderColor: colors.warning,
    borderStyle: 'dashed',
  },
  debugLabel: {
    color: colors.warning,
  },
  debugGroup: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.semibold,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  debugRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  debugButton: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.overlayLight,
  },
  debugButtonDestructive: {
    borderColor: colors.error,
  },
  debugButtonText: {
    color: colors.goldBright,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
  },
  debugButtonTextDestructive: {
    color: colors.error,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.touchTarget,
  },
  linkText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
});
