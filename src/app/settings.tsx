import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '../components/common/AppScreen';
import { Divider } from '../components/common/Divider';
import { ScreenTitleRow } from '../components/common/ScreenTitleRow';
import { SecondaryButton } from '../components/common/SecondaryButton';
import { SectionCard } from '../components/common/SectionCard';
import { ProgressionHeader } from '../components/progression/ProgressionHeader';
import {
  CountCoachRow,
  DealerSpeedStepper,
  ToggleRow,
} from '../components/settings/SettingsRows';
import { FEATURES } from '../constants/features';
import { CASINO_MAPS } from '../engine/betting/casino';
import { devResetSave } from '../persistence/hydrate';
import {
  debugResetLevelsAndMaps,
  FLASH_DEBUG_AVAILABLE,
  useFlashDebugStore,
} from '../stores/flashDebugStore';
import { MAX_DISPLAY_NAME_LENGTH } from '../persistence/schema';
import { useDojoStore } from '../stores/dojoStore';
import { useProfileStore } from '../stores/profileStore';
import {
  DEALER_SPEED_MAX,
  DEALER_SPEED_MIN,
  DEALER_SPEED_STEP,
  useSettingsStore,
} from '../stores/settingsStore';
import { colors, fontSizes, layout, radii, spacing } from '../theme';

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettingsStore();
  const displayName = useProfileStore((state) => state.displayName);
  const setDisplayName = useProfileStore((state) => state.setDisplayName);
  const [nameDraft, setNameDraft] = useState(displayName);

  function commitName() {
    setDisplayName(nameDraft);
    // Reflect the sanitized result back into the field.
    setNameDraft(useProfileStore.getState().displayName);
  }

  function handleDevReset() {
    Alert.alert('Reset save?', 'All progress on this device will be erased.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          void devResetSave();
        },
      },
    ]);
  }

  const resetDojoProgress = useDojoStore((state) => state.resetProgress);
  const startOnboarding = useDojoStore((state) => state.startOnboarding);

  function handleResetDojo() {
    Alert.alert('Reset dojo progress?', 'Lessons, drill bests, and objectives will reset.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => resetDojoProgress(),
      },
    ]);
  }

  const debugUnlockAll = useFlashDebugStore((state) => state.unlockAll);
  const setDebugUnlockAll = useFlashDebugStore((state) => state.setUnlockAll);
  const debugTutorialEveryLevel = useFlashDebugStore((state) => state.tutorialEveryLevel);
  const setDebugTutorialEveryLevel = useFlashDebugStore((state) => state.setTutorialEveryLevel);

  function handleDebugResetLevels() {
    Alert.alert('Reset levels & maps?', 'Ladder progress, licenses, and map unlocks reset.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => debugResetLevelsAndMaps() },
    ]);
  }

  function handleReplayOnboarding() {
    // Launch no longer routes through the intro; open it on demand instead.
    startOnboarding();
    router.push('/onboarding');
  }

  return (
    <AppScreen header={<ProgressionHeader />}>
      <ScreenTitleRow title="Settings" />
      <View style={styles.stack}>
        <SectionCard title="Player">
          <Text style={styles.fieldLabel}>Display name</Text>
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            onBlur={commitName}
            onSubmitEditing={commitName}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            returnKeyType="done"
            style={styles.nameInput}
            placeholder="Player"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Display name"
          />
        </SectionCard>

        <SectionCard title="Feedback">
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
          <ToggleRow
            label="Reduce motion"
            value={settings.reducedMotion}
            onChange={settings.setReducedMotion}
          />
        </SectionCard>

        <SectionCard title="Dealer speed">
          <DealerSpeedStepper
            value={settings.dealerSpeed}
            min={DEALER_SPEED_MIN}
            max={DEALER_SPEED_MAX}
            step={DEALER_SPEED_STEP}
            onChange={settings.setDealerSpeed}
          />
        </SectionCard>

        <SectionCard title="Decks">
          <Text style={styles.deckInfo}>
            Every casino deals its own shoe — tables and count sprints alike.
          </Text>
          {CASINO_MAPS.map((map) => (
            <Text key={map.id} style={styles.deckList}>
              {map.name} — {map.deckCount} {map.deckCount === 1 ? 'deck' : 'decks'}
            </Text>
          ))}
        </SectionCard>

        {FEATURES.countCoachDial ? (
          <>
            <SectionCard title="Count Coach">
              <CountCoachRow
                selected={settings.countCoachLevel}
                onSelect={settings.setCountCoachLevel}
              />
            </SectionCard>

            <SectionCard title="Full coach tools">
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
            </SectionCard>
          </>
        ) : null}

        <SectionCard title="Progress">
          <View style={styles.linkGrid}>
            <SecondaryButton label="Statistics" onPress={() => router.push('/review')} />
            <SecondaryButton label="Achievements" onPress={() => router.push('/achievements')} />
            <SecondaryButton label="Profile" onPress={() => router.push('/profile')} />
          </View>
        </SectionCard>

        <SectionCard title="Practice">
          <View style={styles.linkGrid}>
            <SecondaryButton label="Lessons" onPress={() => router.push('/learn')} />
            <SecondaryButton label="Drills" onPress={() => router.push('/drill')} />
            <SecondaryButton label="How to play" onPress={() => router.push('/how-to-play')} />
          </View>
        </SectionCard>

        <SectionCard title="Dojo">
          <SecondaryButton label="Replay onboarding" onPress={handleReplayOnboarding} />
          <View style={styles.resetSpacer}>
            <SecondaryButton label="Reset dojo progress" onPress={handleResetDojo} />
          </View>
        </SectionCard>

        {FLASH_DEBUG_AVAILABLE ? (
          <SectionCard title="Development">
            <ToggleRow
              label="Unlock all levels & maps"
              value={debugUnlockAll}
              onChange={setDebugUnlockAll}
            />
            <Divider />
            <ToggleRow
              label="Tutorial on every level"
              value={debugTutorialEveryLevel}
              onChange={setDebugTutorialEveryLevel}
            />
            <Divider />
            <View style={styles.resetSpacer}>
              <SecondaryButton label="Reset levels & maps" onPress={handleDebugResetLevels} />
            </View>
            <View style={styles.resetSpacer}>
              <SecondaryButton label="Reset save data" onPress={handleDevReset} />
            </View>
          </SectionCard>
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  deckInfo: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  deckList: {
    color: colors.textMuted,
    fontSize: fontSizes.small,
    fontVariant: ['tabular-nums'],
    lineHeight: 22,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    marginBottom: spacing.sm,
  },
  nameInput: {
    minHeight: layout.touchTarget,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.backgroundElevated,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.body,
  },
  resetSpacer: {
    marginTop: spacing.md,
  },
  linkGrid: {
    gap: spacing.sm,
  },
});
