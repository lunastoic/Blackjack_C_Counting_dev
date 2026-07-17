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
  DeckCountRow,
  ToggleRow,
} from '../components/settings/SettingsRows';
import { devResetSave } from '../persistence/hydrate';
import { MAX_DISPLAY_NAME_LENGTH } from '../persistence/schema';
import { useProfileStore } from '../stores/profileStore';
import {
  DEALER_SPEED_MAX,
  DEALER_SPEED_MIN,
  DEALER_SPEED_STEP,
  useSettingsStore,
} from '../stores/settingsStore';
import { useGameSessionStore } from '../stores/gameSessionStore';
import { colors, fontSizes, layout, radii, spacing } from '../theme';

export default function SettingsScreen() {
  const settings = useSettingsStore();
  const applyDeckCountChange = useGameSessionStore((state) => state.applyDeckCountChange);
  const displayName = useProfileStore((state) => state.displayName);
  const setDisplayName = useProfileStore((state) => state.setDisplayName);
  const [nameDraft, setNameDraft] = useState(displayName);

  function handleDeckCount(mode: 'regular' | 'quiz', count: number) {
    settings.setDeckCount(mode, count);
    if (mode === 'regular') {
      applyDeckCountChange();
    }
  }

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
          <DeckCountRow
            label="Table"
            mode="regular"
            selected={settings.deckCounts.regular}
            onSelect={handleDeckCount}
          />
          <Divider />
          <DeckCountRow
            label="Quiz"
            mode="quiz"
            selected={settings.deckCounts.quiz}
            onSelect={handleDeckCount}
          />
        </SectionCard>

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

        {__DEV__ ? (
          <SectionCard title="Development">
            <SecondaryButton label="Reset save data" onPress={handleDevReset} />
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
});
