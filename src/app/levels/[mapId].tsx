import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAP_ART } from '../../assets/registry';
import { PressableScale } from '../../components/common/PressableScale';
import { LevelPath } from '../../components/levels/LevelPath';
import { CASINO_MAPS, CasinoMap, mapById } from '../../engine/betting/casino';
import { FLASH_LEVELS_PER_MAP, FlashProgress, nextFlashLevel } from '../../engine/dojo';
import { useDojoStore } from '../../stores/dojoStore';
import {
  debugCompleteMap,
  debugCompleteNextLevel,
  debugResetLevelsAndMaps,
  FLASH_DEBUG_AVAILABLE,
  useFlashDebugStore,
} from '../../stores/flashDebugStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { colors, fontSizes, fontWeights, layout, radii, shadows, spacing } from '../../theme';
import { formatChips } from '../../utils/format';

/** Card takes most of the width; the neighbours peek in from the edges. */
const CARD_WIDTH_RATIO = 0.8;
const CARD_GAP = spacing.md;
/** Card height is capped so it reads as a card, not a full-screen panel. */
const CARD_MAX_HEIGHT = 520;

/**
 * Select Map: one casino card at a time, swipe to slide between them. Each
 * card carries its art, its bet ceiling, and the six-level training ladder;
 * table + quiz open once the ladder is cleared.
 */
export default function LevelMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { mapId } = useLocalSearchParams<{ mapId: string }>();
  const parsed = Number(mapId);
  const initialIndex = Math.max(
    0,
    CASINO_MAPS.findIndex((map) => map.id === parsed),
  );
  const cardWidth = Math.round(width * CARD_WIDTH_RATIO);
  const snap = cardWidth + CARD_GAP;
  const sidePadding = (width - cardWidth) / 2;

  const [active, setActive] = useState(initialIndex);
  const [pagedTo, setPagedTo] = useState(initialIndex);
  // Cards fill the pager's height exactly — measured, since a horizontal list
  // gives its rows no height of their own.
  const [pagerHeight, setPagerHeight] = useState(0);
  const listRef = useRef<FlatList<CasinoMap>>(null);

  // Re-page when the route param changes while the screen stays mounted.
  if (pagedTo !== initialIndex) {
    setPagedTo(initialIndex);
    setActive(initialIndex);
  }
  useEffect(() => {
    listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
  }, [initialIndex]);

  const progress = useDojoStore((state) => state.flashLevels);
  const unlockedMapIds = useProgressionStore((state) => state.unlockedMapIds);
  const debugUnlockAll = useFlashDebugStore((state) => FLASH_DEBUG_AVAILABLE && state.unlockAll);

  if (!Number.isInteger(parsed) || !mapById(parsed)) {
    return <Redirect href={{ pathname: '/levels/[mapId]', params: { mapId: '1' } }} />;
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / snap);
    setActive(Math.min(Math.max(index, 0), CASINO_MAPS.length - 1));
  }

  function openLevel(map: CasinoMap, level: number) {
    router.push({
      pathname: '/flash/[mapId]/[level]',
      params: { mapId: String(map.id), level: String(level) },
    });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.title}>Select Map</Text>
        <PressableScale
          accessibilityLabel="Settings, stats and achievements"
          onPress={() => router.push('/settings')}
          style={styles.headerButton}
        >
          <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
        </PressableScale>
      </View>

      <FlatList
        ref={listRef}
        style={styles.pager}
        onLayout={(event: LayoutChangeEvent) =>
          setPagerHeight(Math.floor(event.nativeEvent.layout.height))
        }
        data={CASINO_MAPS}
        horizontal
        snapToInterval={snap}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        contentContainerStyle={{ paddingHorizontal: sidePadding, alignItems: 'center' }}
        getItemLayout={(_, index) => ({ length: snap, offset: snap * index, index })}
        onMomentumScrollEnd={onScrollEnd}
        keyExtractor={(map) => String(map.id)}
        renderItem={({ item, index }) => (
          <MapCard
            map={item}
            width={cardWidth}
            height={Math.min(Math.max(0, pagerHeight - spacing.md), CARD_MAX_HEIGHT)}
            isActive={index === active}
            isLast={index === CASINO_MAPS.length - 1}
            progress={progress}
            unlocked={unlockedMapIds.includes(item.id) || debugUnlockAll}
            unlockAll={debugUnlockAll}
            onSelectLevel={(level) => openLevel(item, level)}
            onTable={() =>
              router.push({ pathname: '/game/[mapId]', params: { mapId: String(item.id) } })
            }
            onQuiz={() =>
              router.push({ pathname: '/quiz/[mapId]', params: { mapId: String(item.id) } })
            }
          />
        )}
      />

      {FLASH_DEBUG_AVAILABLE ? (
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>DEV</Text>
          <Text
            style={styles.devLink}
            onPress={() => debugCompleteNextLevel(CASINO_MAPS[active].id)}
            accessibilityRole="button"
          >
            +1 level
          </Text>
          <Text
            style={styles.devLink}
            onPress={() => debugCompleteMap(CASINO_MAPS[active].id)}
            accessibilityRole="button"
          >
            Clear map
          </Text>
          <Text
            style={styles.devLink}
            onPress={debugResetLevelsAndMaps}
            accessibilityRole="button"
          >
            Reset all
          </Text>
        </View>
      ) : null}

      <View style={styles.dots} accessibilityLabel={`Casino ${active + 1} of ${CASINO_MAPS.length}`}>
        {CASINO_MAPS.map((map, index) => (
          <PressableScale
            key={map.id}
            accessibilityLabel={map.name}
            onPress={() => listRef.current?.scrollToIndex({ index, animated: true })}
            style={[styles.dot, index === active && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

interface MapCardProps {
  readonly map: CasinoMap;
  readonly width: number;
  readonly height: number;
  readonly isActive: boolean;
  readonly isLast: boolean;
  readonly progress: FlashProgress;
  readonly unlocked: boolean;
  readonly unlockAll: boolean;
  readonly onSelectLevel: (level: number) => void;
  readonly onTable: () => void;
  readonly onQuiz: () => void;
}

function MapCard({
  map,
  width,
  height,
  isActive,
  isLast,
  progress,
  unlocked,
  unlockAll,
  onSelectLevel,
  onTable,
  onQuiz,
}: MapCardProps) {
  const next = nextFlashLevel(progress, map.id);
  const tableOpen = next === null;
  const remaining = next === null ? 0 : FLASH_LEVELS_PER_MAP - next + 1;
  const previous = mapById(map.id - 1);
  const pathWidth = width - spacing.md * 2;
  // The ladder is laid out to whatever height is left under the banner — no scrolling.
  const [pathHeight, setPathHeight] = useState(0);

  function onPathLayout(event: LayoutChangeEvent) {
    setPathHeight(Math.floor(event.nativeEvent.layout.height));
  }

  return (
    <View
      style={[
        styles.card,
        { width, height, marginRight: isLast ? 0 : CARD_GAP },
        !isActive && styles.cardInactive,
      ]}
    >
      {/* Square art box as tall as the card, centred: the whole skyline shows, sides crop. */}
      <Image
        source={MAP_ART[map.artKey]}
        style={[
          styles.art,
          { width: height, height, left: (width - height) / 2 },
          !unlocked && styles.artLocked,
        ]}
        resizeMode="cover"
      />
      <View style={styles.nameRow}>
        {!unlocked ? <Ionicons name="lock-closed" size={16} color={colors.textSecondary} /> : null}
        <Text style={styles.mapName} numberOfLines={1}>
          {map.name}
        </Text>
      </View>

      {tableOpen ? (
        <View style={styles.modeRow}>
          <PressableScale
            accessibilityLabel={`Play blackjack at ${map.name}`}
            onPress={onTable}
            style={styles.modeButton}
          >
            <Ionicons name="play" size={16} color={colors.textOnGold} />
            <Text style={styles.modeButtonText}>Table</Text>
          </PressableScale>
          <PressableScale
            accessibilityLabel={`Quiz mode at ${map.name}`}
            onPress={onQuiz}
            style={[styles.modeButton, styles.modeButtonQuiz]}
          >
            <Ionicons name="flash" size={16} color={colors.goldBright} />
            <Text style={[styles.modeButtonText, styles.modeButtonQuizText]}>Quiz</Text>
          </PressableScale>
        </View>
      ) : (
        <Text style={styles.meta} numberOfLines={1}>
          {!unlocked
            ? `Finish level ${FLASH_LEVELS_PER_MAP} at ${previous?.name ?? 'the previous casino'}`
            : `${remaining} level${remaining === 1 ? '' : 's'} to open the table · max bet ${formatChips(map.maxBet)}`}
        </Text>
      )}

      <View style={[styles.pathWrap, !unlocked && styles.pathLocked]} onLayout={onPathLayout}>
        {pathHeight > 0 ? (
          <LevelPath
            map={map}
            progress={progress}
            width={pathWidth}
            height={pathHeight}
            onSelect={onSelectLevel}
            interactive={unlocked}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.sm,
  },
  headerSpacer: {
    width: layout.touchTarget,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.heavy,
  },
  headerButton: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pager: {
    flex: 1,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.background,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
    ...shadows.raised,
  },
  cardInactive: {
    opacity: 0.55,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  mapName: {
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.heavy,
    textAlign: 'center',
  },
  /** Casino art fills the card behind the ladder, dimmed to keep the chips legible. */
  art: {
    position: 'absolute',
    top: 0,
    opacity: 0.5,
  },
  artLocked: {
    opacity: 0.18,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    textAlign: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.goldBright,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  modeButtonText: {
    color: colors.textOnGold,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.heavy,
  },
  modeButtonQuiz: {
    backgroundColor: colors.overlayLight,
  },
  modeButtonQuizText: {
    color: colors.goldBright,
  },
  pathWrap: {
    flex: 1,
    minHeight: 0,
  },
  pathLocked: {
    opacity: 0.35,
  },
  devRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  devLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1.5,
  },
  devLink: {
    color: colors.warning,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
    textDecorationLine: 'underline',
    paddingVertical: spacing.xs,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderSubtle,
  },
  dotActive: {
    backgroundColor: colors.textPrimary,
  },
});
