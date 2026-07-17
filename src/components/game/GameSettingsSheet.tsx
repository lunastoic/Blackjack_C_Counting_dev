import { Href, useRouter } from 'expo-router';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { Divider } from '../common/Divider';
import { PressableScale } from '../common/PressableScale';
import {
  CountCoachRow,
  DealerSpeedStepper,
  DeckCountRow,
  ToggleRow,
} from '../settings/SettingsRows';

const TAB_SIZE = layout.touchTarget;
const MENU_WIDTH = 320;

/** In-game settings dropdown that hangs from the top-right ≡ tab. */
export function GameSettingsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const settings = useSettingsStore();
  const applyDeckCountChange = useGameSessionStore((state) => state.applyDeckCountChange);

  function goTo(href: Href) {
    onClose();
    router.push(href);
  }

  function handleDeckCount(_mode: 'regular' | 'quiz', count: number) {
    settings.setDeckCount('regular', count);
    applyDeckCountChange();
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
          accessibilityLabel="Close settings"
          accessibilityRole="button"
        />

        <View
          style={[
            styles.anchor,
            {
              top: insets.top + spacing.sm,
              right: layout.screenPaddingH,
            },
          ]}
        >
          {/* Tab tip — aligns with the HUD ≡ so the menu reads as dropping from it. */}
          <PressableScale
            accessibilityLabel="Close table settings"
            onPress={onClose}
            style={styles.tab}
          >
            <Text style={styles.tabGlyph}>≡</Text>
          </PressableScale>

          <View style={styles.panel}>
            <View style={styles.headerRow}>
              <Text style={styles.title} numberOfLines={1}>
                Table Settings
              </Text>
              <PressableScale
                accessibilityLabel="Close"
                onPress={onClose}
                style={styles.closeHit}
              >
                <Text style={styles.closeGlyph}>×</Text>
              </PressableScale>
            </View>

            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
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
              <Divider />
              <DealerSpeedStepper
                value={settings.dealerSpeed}
                min={DEALER_SPEED_MIN}
                max={DEALER_SPEED_MAX}
                step={DEALER_SPEED_STEP}
                onChange={settings.setDealerSpeed}
              />
              <Divider />
              <DeckCountRow
                label="Table decks"
                mode="regular"
                selected={settings.deckCounts.regular}
                onSelect={handleDeckCount}
              />
              <Text style={styles.note}>
                Changing decks mid-shoe reshuffles immediately between hands and resets the
                count. Mid-hand changes apply after this round. All shoes use 88% penetration.
              </Text>
              <Divider />
              <CountCoachRow
                selected={settings.countCoachLevel}
                onSelect={settings.setCountCoachLevel}
              />
              {settings.countCoachLevel === 'full' ? (
                <>
                  <Divider />
                  <Text style={styles.sectionLabel}>Full coach tools</Text>
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
                </>
              ) : null}
              <Divider />
              <View style={styles.links}>
                <PressableScale style={styles.linkButton} onPress={() => goTo('/profile')}>
                  <Text style={styles.linkText}>Profile & Achievements</Text>
                </PressableScale>
                <PressableScale style={styles.linkButton} onPress={() => goTo('/rewards')}>
                  <Text style={styles.linkText}>Rewards</Text>
                </PressableScale>
                <PressableScale style={styles.linkButton} onPress={() => goTo('/achievements')}>
                  <Text style={styles.linkText}>Statistics</Text>
                </PressableScale>
                <PressableScale style={styles.linkButton} onPress={() => goTo('/how-to-play')}>
                  <Text style={styles.linkText}>How to Play</Text>
                </PressableScale>
                <PressableScale style={styles.linkButton} onPress={() => goTo('/settings')}>
                  <Text style={styles.linkText}>Player Settings</Text>
                </PressableScale>
              </View>
            </ScrollView>
          </View>
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
    backgroundColor: colors.overlay,
  },
  anchor: {
    position: 'absolute',
    width: MENU_WIDTH,
    maxWidth: '92%',
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    maxHeight: 520,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.subtitle,
    fontWeight: fontWeights.bold,
  },
  closeHit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    color: colors.textSecondary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.semibold,
  },
  scroll: {
    maxHeight: 440,
  },
  note: {
    color: colors.textMuted,
    fontSize: fontSizes.caption,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    color: colors.goldBright,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingTop: spacing.xs,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  linkButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.overlayLight,
  },
  linkText: {
    color: colors.goldBright,
    fontSize: fontSizes.small,
    fontWeight: fontWeights.semibold,
  },
});
