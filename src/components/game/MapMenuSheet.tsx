import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
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
import {
  FLASH_LEVELS_PER_MAP,
  flashStars,
  nextFlashLevel,
  STAR_COUNT,
  trainingLevelsForMap,
} from '../../engine/dojo';
import { useModernUi } from '../../hooks/useModernUi';
import { useDojoStore } from '../../stores/dojoStore';
import { FLASH_DEBUG_AVAILABLE, useFlashDebugStore } from '../../stores/flashDebugStore';
import { colors, fonts, fontSizes, layout, shadows, spacing } from '../../theme';
import { formatChips } from '../../utils/format';
import {
  ArcadeBadge,
  ArcadeButton,
  ArcadeFlag,
  ArcadePanel,
  ArcadeSquare,
  arcadeShadow,
} from '../arcade';
import { PressableScale } from '../common/PressableScale';
import { artForLevel, nodeState } from '../levels/LevelPath';

const TAB_SIZE = layout.touchTarget;
/** Same width as the ≡ menu: the two dropdowns hang from either end of the HUD as a pair. */
const MENU_WIDTH = 353;
const ART_SIZE = 40;

/**
 * Modern only. The dropdown hanging from the HUD's map square — the home
 * button of the table: this casino's six levels with their stars, a way back
 * to the level map, and the table once it's open. Classic keeps navigating to
 * the level map, so this draws nothing there.
 */
export function MapMenuSheet({
  visible,
  onClose,
  mapId,
  currentLevel,
  atTable = false,
}: {
  visible: boolean;
  onClose: () => void;
  mapId: number;
  /** The training level on screen — its row reads as "here", and picking another swaps in place. */
  currentLevel?: number;
  /** At the table already: the Play Table button stays out of the way. */
  atTable?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const modern = useModernUi();
  const progress = useDojoStore((state) => state.flashLevels);
  const unlockAll = useFlashDebugStore((state) => FLASH_DEBUG_AVAILABLE && state.unlockAll);
  const map = mapById(mapId);

  if (!modern || !map) {
    return null;
  }

  const casino = map;
  const next = nextFlashLevel(progress, casino.id);
  const tableOpen = next === null;
  const remaining = next === null ? 0 : FLASH_LEVELS_PER_MAP - next + 1;
  const status = tableOpen
    ? `All ${FLASH_LEVELS_PER_MAP} levels cleared · max bet ${formatChips(casino.maxBet)}`
    : `${remaining} level${remaining === 1 ? '' : 's'} to open the table · max bet ${formatChips(casino.maxBet)}`;

  function openLevel(level: number) {
    onClose();
    if (level === currentLevel) {
      return;
    }
    const href = {
      pathname: '/flash/[mapId]/[level]',
      params: { mapId: String(casino.id), level: String(level) },
    } as const;
    // On a level already: swap it for the new one, as the level-done panel
    // does. From the table: stack it, so the map square can unwind back.
    if (currentLevel === undefined) {
      router.push(href);
    } else {
      router.replace(href);
    }
  }

  // The level map is normally the screen under this one; unwind to it rather
  // than stacking another copy (each keeps six posters decoded).
  function openLevelMap() {
    onClose();
    router.dismissTo({ pathname: '/levels/[mapId]', params: { mapId: String(casino.id) } });
  }

  function sitAtTable() {
    onClose();
    router.dismissTo({ pathname: '/game/[mapId]', params: { mapId: String(casino.id) } });
  }

  const anchorTop = insets.top + spacing.sm;
  const panelMaxHeight = windowHeight - anchorTop - TAB_SIZE - insets.bottom - spacing.xl;

  // The felt panel hangs from the HUD's map square, drawn open (foot squared
  // off) in the same spot so the menu reads as dropping out of it.
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close level menu"
          accessibilityRole="button"
        />

        <View
          style={[
            styles.anchor,
            {
              top: anchorTop,
              left: layout.screenPaddingH,
              width: Math.min(MENU_WIDTH, windowWidth - layout.screenPaddingH * 2),
            },
          ]}
        >
          <ArcadeSquare
            onPress={onClose}
            open
            accessibilityLabel="Close level menu"
            accessibilityState={{ expanded: true }}
            style={styles.square}
          >
            <Ionicons name="map-outline" size={22} color={colors.arcadeGold} />
          </ArcadeSquare>

          <ArcadePanel style={[styles.panel, { maxHeight: panelMaxHeight }]}>
            <View style={styles.header}>
              <Text style={styles.casino} numberOfLines={1}>
                {casino.name.toUpperCase()}
              </Text>
              <Text style={styles.status}>{status}</Text>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.levels}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {trainingLevelsForMap(casino.id).map((spec) => {
                const state = nodeState(progress, casino.id, spec.level);
                // DEV: every level is tappable regardless of progress.
                const locked = state === 'locked' && !unlockAll;
                const here = spec.level === currentLevel;
                const stars = flashStars(progress, casino.id, spec.level);
                const art = artForLevel(casino, spec.level);
                return (
                  <PressableScale
                    key={spec.level}
                    accessibilityRole="button"
                    accessibilityLabel={`Level ${spec.level}: ${spec.title}${locked ? ', locked' : ''}${here ? ', current level' : ''}, ${stars} of ${STAR_COUNT} stars`}
                    accessibilityState={{ disabled: locked, selected: here }}
                    disabled={locked}
                    onPress={() => openLevel(spec.level)}
                    style={[styles.row, here && styles.rowHere]}
                  >
                    <View style={styles.art}>
                      <Image
                        source={art.source}
                        style={[
                          { width: ART_SIZE * art.scale, height: ART_SIZE * art.scale },
                          locked && styles.artLocked,
                        ]}
                        contentFit="contain"
                      />
                      {/* A muted silhouette washes the colour out of locked art (no grayscale
                          filter without a native image library). */}
                      {locked ? (
                        <Image
                          source={art.source}
                          style={[
                            styles.artWash,
                            { width: ART_SIZE * art.scale, height: ART_SIZE * art.scale },
                          ]}
                          tintColor={colors.arcadeMuted}
                          contentFit="contain"
                        />
                      ) : null}
                    </View>

                    <View style={styles.copy}>
                      <Text style={[styles.title, locked && styles.titleLocked]} numberOfLines={1}>
                        {`${spec.level}. ${spec.title}`.toUpperCase()}
                      </Text>
                      <View style={styles.stars}>
                        {Array.from({ length: STAR_COUNT }, (_, index) => (
                          <Ionicons
                            key={index}
                            name={index < stars ? 'star' : 'star-outline'}
                            size={14}
                            color={index < stars ? colors.arcadeGold : colors.arcadeMuted}
                            style={arcadeShadow.soft}
                          />
                        ))}
                      </View>
                    </View>

                    {state === 'done' ? <ArcadeBadge kind="check" /> : null}
                    {locked ? <ArcadeBadge kind="lock" /> : null}
                    {spec.level === next ? <ArcadeFlag label="Start" /> : null}
                  </PressableScale>
                );
              })}
            </ScrollView>

            <View style={styles.foot}>
              <ArcadeButton
                label="Level Map"
                size="small"
                variant="neutral"
                leading={<Ionicons name="map-outline" size={16} color={colors.arcadeCream} />}
                onPress={openLevelMap}
                accessibilityLabel={`${casino.name} level map`}
                style={styles.footButton}
              />
              {!atTable ? (
                <ArcadeButton
                  label="Play Table"
                  size="small"
                  variant="gold"
                  leading={tableOpen ? '▶' : <Ionicons name="lock-closed" size={14} color={colors.arcadeInkOnLight} />}
                  disabled={!tableOpen}
                  onPress={sitAtTable}
                  accessibilityLabel={
                    tableOpen
                      ? `Play blackjack at ${casino.name}, max bet ${formatChips(casino.maxBet)}`
                      : `${casino.name} table opens in ${remaining} level${remaining === 1 ? '' : 's'}`
                  }
                  style={styles.footButton}
                />
              ) : null}
            </View>
          </ArcadePanel>
        </View>
      </View>
    </Modal>
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
    backgroundColor: colors.lockedTint,
  },
  anchor: {
    position: 'absolute',
    alignItems: 'flex-start',
    ...shadows.overlay,
  },
  /** Overlaps the panel's top edge so the square's ink outline reads as one piece with it. */
  square: {
    marginBottom: -3,
    zIndex: 1,
  },
  panel: {
    width: '100%',
    // Ink, not the felt edge: the tab's outline runs straight into the
    // panel's, so the menu reads as one piece hanging from the tab.
    borderColor: colors.arcadeInk,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xxs,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.xs,
    gap: 2,
  },
  casino: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: 1,
    color: colors.arcadeGold,
    includeFontPadding: false,
    ...arcadeShadow.deep,
  },
  status: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.caption - 1,
    lineHeight: fontSizes.caption + 3,
    color: colors.arcadeMuted,
  },
  scroll: {
    flexGrow: 0,
  },
  levels: {
    gap: spacing.xs + spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xxs,
    minHeight: 56,
    backgroundColor: colors.arcadeInfoFill,
    borderWidth: 2,
    borderColor: colors.arcadeInfoEdge,
    borderRadius: 14,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  /** The level on screen: outlined in gold so the menu says where you are. */
  rowHere: {
    borderColor: colors.arcadeGold,
  },
  art: {
    width: ART_SIZE,
    height: ART_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artLocked: {
    opacity: 0.5,
  },
  artWash: {
    position: 'absolute',
    opacity: 0.45,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 19,
    lineHeight: 20,
    letterSpacing: 0.5,
    color: colors.arcadeCream,
    includeFontPadding: false,
    ...arcadeShadow.deep,
  },
  titleLocked: {
    color: colors.arcadeMuted,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  foot: {
    flexDirection: 'row',
    gap: spacing.xs + spacing.xxs,
  },
  footButton: {
    flex: 1,
  },
});
