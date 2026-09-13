import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  AccessibilityRole,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mapById } from '../../engine/betting/casino';
import { progressFor } from '../../engine/achievements/engine';
import { achievementsForMap } from '../../engine/achievements/mapDefinitions';
import { INITIAL_STATS } from '../../engine/achievements/stats';
import { UI_STYLES } from '../../engine/types';
import { useModernUi } from '../../hooks/useModernUi';
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
import { useWeakSpotsStore } from '../../stores/weakSpotsStore';
import {
  colors,
  fonts,
  fontSizes,
  fontWeights,
  layout,
  radii,
  shadows,
  spacing,
} from '../../theme';
import { FEATURES } from '../../constants/features';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { COUNT_COACH_BLURBS, COUNT_COACH_LABELS, COUNT_COACH_ORDER } from '../../utils/countCoach';
import {
  ArcadeBar,
  ArcadeButton,
  ArcadePanel,
  ArcadeSquare,
  ArcadeSwitch,
  ArcadeTag,
  arcadeShadow,
  arcadeText,
} from '../arcade';
import { Divider } from '../common/Divider';
import { PressableScale } from '../common/PressableScale';
import { ProgressBar } from '../common/ProgressBar';
import {
  CountCoachRow,
  DealerSpeedStepper,
  UI_STYLE_BLURBS,
  UI_STYLE_LABELS,
  UiStyleRow,
  ToggleRow,
} from '../settings/SettingsRows';

const TAB_SIZE = layout.touchTarget;
const MENU_WIDTH = 380;
/** The Modern panel is narrower — it hangs from the HUD's ≡ square, inside the felt margin. */
const MODERN_MENU_WIDTH = 353;

type MenuTab = 'achievements' | 'training' | 'settings';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: readonly { key: MenuTab; label: string; modernLabel: string; icon: IoniconName }[] = [
  { key: 'achievements', label: 'Achievements', modernLabel: 'Trophies', icon: 'trophy' },
  { key: 'training', label: 'Training', modernLabel: 'Training', icon: 'school' },
  { key: 'settings', label: 'Settings', modernLabel: 'Settings', icon: 'settings-sharp' },
];

/** In-game dropdown that hangs from the top-right ≡ tab: achievements, training aids, settings. */
export function GameSettingsSheet({
  visible,
  onClose,
  mapId,
  initialTab = 'achievements',
}: {
  visible: boolean;
  onClose: () => void;
  /** Casino whose achievements fill the first tab. */
  mapId: number;
  /** The tab shown first; the menu keeps its own tab once open. */
  initialTab?: MenuTab;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const modern = useModernUi();
  const [tab, setTab] = useState<MenuTab>(initialTab);

  function goTo(href: Href) {
    onClose();
    router.push(href);
  }

  const anchorTop = insets.top + spacing.sm;
  const panelMaxHeight = windowHeight - anchorTop - TAB_SIZE - insets.bottom - spacing.xl;

  if (modern) {
    // The felt panel hangs from the HUD's ≡ square, drawn open (foot squared
    // off) in the same spot so the menu reads as dropping out of it.
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.root}>
          <Pressable
            style={[styles.backdrop, styles.backdropModern]}
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
                width: Math.min(MODERN_MENU_WIDTH, windowWidth - layout.screenPaddingH * 2),
              },
            ]}
          >
            <ArcadeSquare
              onPress={onClose}
              tone="plaque"
              open
              accessibilityLabel="Close menu"
              accessibilityState={{ expanded: true }}
              style={styles.squareModern}
            >
              <Ionicons name="menu" size={26} color={colors.arcadeGold} />
            </ArcadeSquare>

            <ArcadePanel style={[styles.panelModern, { maxHeight: panelMaxHeight }]}>
              <View style={styles.tabsModern} accessibilityRole="tablist">
                {TABS.map((item) => {
                  const active = item.key === tab;
                  return (
                    <Selectable
                      key={item.key}
                      role="tab"
                      label={item.label}
                      selected={active}
                      style={styles.tabButtonModern}
                    >
                      <ArcadeButton
                        label={item.modernLabel}
                        size="small"
                        variant={active ? 'gold' : 'neutral'}
                        leading={
                          <Ionicons
                            name={item.icon}
                            size={16}
                            color={active ? colors.arcadeInkOnLight : colors.arcadeCream}
                          />
                        }
                        onPress={() => setTab(item.key)}
                        accessibilityLabel={item.label}
                      />
                    </Selectable>
                  );
                })}
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.contentModern}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {tab === 'achievements' ? <AchievementsTab mapId={mapId} modern /> : null}
                {tab === 'training' ? <TrainingTab onNavigate={goTo} modern /> : null}
                {tab === 'settings' ? <SettingsTab mapId={mapId} onNavigate={goTo} modern /> : null}
              </ScrollView>
            </ArcadePanel>
          </View>
        </View>
      </Modal>
    );
  }

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

function AchievementsTab({ mapId, modern = false }: { mapId: number; modern?: boolean }) {
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

  if (modern) {
    return (
      <>
        <Text style={[arcadeText.caption, styles.summaryModern]}>
          {unlocked} of {list.length} unlocked at this table
        </Text>
        {list.map(({ definition, progress }) => (
          <View key={definition.id} style={[styles.cardModern, styles.achievementCardModern]}>
            <View style={styles.trophySlot}>
              <Ionicons
                name={progress.unlocked ? 'trophy' : 'trophy-outline'}
                size={26}
                color={progress.unlocked ? colors.arcadeGold : colors.arcadeMuted}
              />
            </View>
            <View style={styles.achievementBody}>
              <Text
                style={[styles.rowLabelModern, progress.unlocked && styles.rowLabelDoneModern]}
                numberOfLines={1}
              >
                {definition.title.toUpperCase()}
              </Text>
              <Text style={styles.rowSubModern} numberOfLines={2}>
                {definition.description}
              </Text>
              <ArcadeBar
                progress={progress.goal > 0 ? progress.current / progress.goal : 0}
                thin
                accessibilityLabel={`${progress.current} of ${progress.goal}`}
                style={styles.achievementBar}
              />
              <Text style={[styles.countModern, progress.unlocked && styles.countDoneModern]}>
                {progress.current}/{progress.goal}
              </Text>
            </View>
          </View>
        ))}
      </>
    );
  }

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

function TrainingTab({
  onNavigate,
  modern = false,
}: {
  onNavigate: (href: Href) => void;
  modern?: boolean;
}) {
  const settings = useSettingsStore();
  const weakSpotCount = useWeakSpotsStore((state) => state.spots.length);
  const weakSpotsLabel = weakSpotCount > 0 ? `Weak spots (${weakSpotCount})` : 'Weak spots';

  if (modern) {
    return (
      <>
        {FEATURES.countCoachDial ? (
          <View style={styles.cardModern}>
            <MenuSegment
              name="Count Coach"
              options={COUNT_COACH_ORDER}
              labels={COUNT_COACH_LABELS}
              selected={settings.countCoachLevel}
              onSelect={settings.setCountCoachLevel}
            />
            <Text style={styles.noteModern}>{COUNT_COACH_BLURBS[settings.countCoachLevel]}</Text>
          </View>
        ) : null}
        {FEATURES.trainingAidToggles ? (
          <>
            <View style={styles.cardModern}>
              <MenuRow label="Training mode">
                <ArcadeSwitch
                  value={settings.trainingMode}
                  onValueChange={settings.setTrainingMode}
                  accessibilityLabel="Training mode"
                />
              </MenuRow>
            </View>
            <View style={styles.cardModern}>
              <MenuRow label="Card underglow">
                <ArcadeSwitch
                  value={settings.trainingAids.cardUnderglow}
                  onValueChange={(v) => settings.setTrainingAid('cardUnderglow', v)}
                  accessibilityLabel="Card underglow"
                />
              </MenuRow>
              <View style={styles.dividerModern} />
              <MenuRow label="Strategy hints">
                <ArcadeSwitch
                  value={settings.trainingAids.strategyHints}
                  onValueChange={(v) => settings.setTrainingAid('strategyHints', v)}
                  accessibilityLabel="Strategy hints"
                />
              </MenuRow>
              <View style={styles.dividerModern} />
              <MenuRow label="Count pulse">
                <ArcadeSwitch
                  value={settings.trainingAids.countPulse}
                  onValueChange={(v) => settings.setTrainingAid('countPulse', v)}
                  accessibilityLabel="Count pulse"
                />
              </MenuRow>
              <View style={styles.dividerModern} />
              <MenuRow label="Distribution charts">
                <ArcadeSwitch
                  value={settings.trainingAids.distributionCharts}
                  onValueChange={(v) => settings.setTrainingAid('distributionCharts', v)}
                  accessibilityLabel="Distribution charts"
                />
              </MenuRow>
            </View>
          </>
        ) : null}
        <View style={styles.cardModern}>
          <MenuRow
            label="Weak spots"
            sub={weakSpotCount > 0 ? `${weakSpotCount} hands to drill` : 'Nothing to drill yet'}
          >
            <ArcadeButton
              label="Open"
              trailing="▶"
              size="medium"
              variant="neutral"
              onPress={() => onNavigate('/weak-spots')}
              accessibilityLabel={weakSpotsLabel}
            />
          </MenuRow>
        </View>
      </>
    );
  }

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
      {FEATURES.trainingAidToggles ? (
        <>
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
        </>
      ) : null}
      <View style={styles.card}>
        <LinkRow
          label={weakSpotsLabel}
          icon="fitness-outline"
          onPress={() => onNavigate('/weak-spots')}
        />
      </View>
    </>
  );
}

const MENU_LINKS: readonly { label: string; icon: IoniconName; href: Href }[] = [
  { label: 'Profile', icon: 'person-outline', href: '/profile' },
  { label: 'Rewards', icon: 'gift-outline', href: '/rewards' },
  { label: 'Statistics', icon: 'stats-chart-outline', href: '/achievements' },
  { label: 'Player Settings', icon: 'options-outline', href: '/settings' },
  { label: 'How to Play', icon: 'book-outline', href: '/how-to-play' },
];

function SettingsTab({
  mapId,
  onNavigate,
  modern = false,
}: {
  mapId: number;
  onNavigate: (href: Href) => void;
  modern?: boolean;
}) {
  const settings = useSettingsStore();
  const map = useGameSessionStore((state) => state.map);
  const deckCount = map?.deckCount ?? 6;
  const pace = map?.dealerPace ?? 1;
  const houseNote = `${map?.name ?? 'This casino'} deals at ${pace.toFixed(2)}× — your setting stacks on top of the house pace. The shoe is ${deckCount} deck${deckCount === 1 ? '' : 's'} at 88% penetration — decks are set by the house, not the settings.`;

  if (modern) {
    const speed = settings.dealerSpeed;
    return (
      <>
        <View style={styles.cardModern}>
          <MenuRow label="Sound">
            <ArcadeSwitch
              value={settings.soundEnabled}
              onValueChange={settings.setSoundEnabled}
              accessibilityLabel="Sound"
            />
          </MenuRow>
          <View style={styles.dividerModern} />
          <MenuRow label="Haptics">
            <ArcadeSwitch
              value={settings.hapticsEnabled}
              onValueChange={settings.setHapticsEnabled}
              accessibilityLabel="Haptics"
            />
          </MenuRow>
        </View>
        <View style={styles.cardModern}>
          <MenuSegment
            name="Look"
            options={UI_STYLES}
            labels={UI_STYLE_LABELS}
            selected={settings.uiStyle}
            onSelect={settings.setUiStyle}
          />
          <Text style={styles.noteModern}>{UI_STYLE_BLURBS[settings.uiStyle]}</Text>
        </View>
        <View style={styles.cardModern}>
          <MenuRow label="Dealer speed" style={styles.rowFlatModern} />
          <View style={styles.speedModern}>
            <ArcadeButton
              label="−"
              round
              size="medium"
              variant="neutral"
              onPress={() => settings.setDealerSpeed(speed - DEALER_SPEED_STEP)}
              disabled={speed <= DEALER_SPEED_MIN}
              accessibilityLabel="Slower dealer"
            />
            <ArcadeTag big label={`${speed.toFixed(2)}×`} style={styles.speedTagModern} />
            <ArcadeButton
              label="+"
              round
              size="medium"
              variant="neutral"
              onPress={() => settings.setDealerSpeed(speed + DEALER_SPEED_STEP)}
              disabled={speed >= DEALER_SPEED_MAX}
              accessibilityLabel="Faster dealer"
            />
          </View>
          <Text style={styles.noteModern}>{houseNote}</Text>
        </View>
        <View style={styles.linksModern}>
          {MENU_LINKS.map((link) => (
            <Pressable
              key={link.label}
              accessibilityRole="button"
              accessibilityLabel={link.label}
              onPress={() => onNavigate(link.href)}
              style={({ pressed }) => [styles.linkPillModern, pressed && styles.linkPillPressedModern]}
            >
              <Text style={styles.linkPillLabelModern}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
        {FLASH_DEBUG_AVAILABLE ? <DebugCard mapId={mapId} /> : null}
      </>
    );
  }

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
        <UiStyleRow selected={settings.uiStyle} onSelect={settings.setUiStyle} />
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
          {map?.name ?? 'This casino'} deals at {pace.toFixed(2)}× — your setting stacks on
          top of the house pace. The shoe is {deckCount} deck{deckCount === 1 ? '' : 's'} at 88%
          penetration — decks are set by the house, not the settings.
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
        <Divider />
        <LinkRow label="How to Play" icon="book-outline" onPress={() => onNavigate('/how-to-play')} />
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

/**
 * ArcadeButton carries no selected state, so a Modern tab or segment wraps
 * one in the accessible element that does; the bevel underneath takes the tap.
 */
function Selectable({
  role,
  label,
  selected,
  style,
  children,
}: {
  role: AccessibilityRole;
  label: string;
  selected: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View
      accessible
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={style}
    >
      {children}
    </View>
  );
}

/** A Modern menu row: pixel label (with an optional mono sub-line) and the control on the right. */
function MenuRow({
  label,
  sub,
  style,
  children,
}: {
  label: string;
  sub?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.rowModern, style]}>
      <View style={styles.rowLabelSlotModern}>
        <Text style={styles.rowLabelModern}>{label.toUpperCase()}</Text>
        {sub ? <Text style={styles.rowSubModern}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** A Modern segment row: the label, then one small bevel per option with the pick in gold. */
function MenuSegment<T extends string>({
  name,
  options,
  labels,
  selected,
  onSelect,
}: {
  name: string;
  options: readonly T[];
  labels: Readonly<Record<T, string>>;
  selected: T;
  onSelect: (option: T) => void;
}) {
  return (
    <MenuRow label={name}>
      <View style={styles.segmentModern}>
        {options.map((option) => {
          const active = option === selected;
          return (
            <Selectable
              key={option}
              role="button"
              label={`${name}: ${labels[option]}`}
              selected={active}
            >
              <ArcadeButton
                label={labels[option]}
                size="xsmall"
                variant={active ? 'gold' : 'neutral'}
                onPress={() => onSelect(option)}
                accessibilityLabel={`${name}: ${labels[option]}`}
              />
            </Selectable>
          );
        })}
      </View>
    </MenuRow>
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
  /* Modern: the felt panel hanging from the open plaque square. */
  backdropModern: {
    backgroundColor: colors.lockedTint,
  },
  /** Overlaps the panel's top edge so the square's ink outline reads as one piece with it. */
  squareModern: {
    marginBottom: -3,
    zIndex: 1,
  },
  panelModern: {
    width: '100%',
    // Ink, not the felt edge: the ≡ tab's outline runs straight into the
    // panel's, so the menu reads as one piece hanging from the tab.
    borderColor: colors.arcadeInk,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xxs,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  tabsModern: {
    flexDirection: 'row',
    gap: spacing.xs + spacing.xxs,
  },
  tabButtonModern: {
    flex: 1,
  },
  contentModern: {
    gap: spacing.sm,
  },
  summaryModern: {
    textAlign: 'left',
    paddingHorizontal: spacing.xs,
  },
  cardModern: {
    backgroundColor: colors.arcadeInfoFill,
    borderWidth: 2,
    borderColor: colors.arcadeInfoEdge,
    borderRadius: 14,
    paddingHorizontal: spacing.sm + spacing.xxs,
    paddingVertical: spacing.sm,
    gap: spacing.xs + spacing.xxs,
  },
  achievementCardModern: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm + spacing.xxs,
    minHeight: 36,
  },
  rowFlatModern: {
    minHeight: 0,
  },
  rowLabelSlotModern: {
    flexShrink: 1,
  },
  rowLabelModern: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: 1,
    color: colors.arcadeCream,
    includeFontPadding: false,
    ...arcadeShadow.deep,
  },
  rowLabelDoneModern: {
    color: colors.arcadeGold,
  },
  rowSubModern: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption - 1,
    lineHeight: fontSizes.caption + 2,
    color: colors.arcadeMuted,
  },
  countModern: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption + 1,
    lineHeight: fontSizes.caption + 7,
    color: colors.arcadeGold,
    fontVariant: ['tabular-nums'],
  },
  countDoneModern: {
    color: colors.arcadeMint,
  },
  dividerModern: {
    height: 1,
    marginHorizontal: -spacing.xxs,
    backgroundColor: colors.arcadeInfoEdge,
  },
  segmentModern: {
    flexDirection: 'row',
    gap: spacing.xs + spacing.xxs,
  },
  noteModern: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption - 1,
    lineHeight: fontSizes.caption + 3,
    color: colors.arcadeMuted,
  },
  speedModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md + spacing.xxs,
    paddingVertical: spacing.xxs,
  },
  speedTagModern: {
    minWidth: 88,
  },
  linksModern: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing.sm,
    rowGap: spacing.xs + spacing.xxs,
  },
  linkPillModern: {
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.borderGold,
    backgroundColor: colors.arcadeInfoFill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  linkPillPressedModern: {
    opacity: 0.7,
  },
  linkPillLabelModern: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption + 1,
    color: colors.arcadeGold,
  },
});
