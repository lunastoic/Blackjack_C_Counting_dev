import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Central haptics service. Screens call these semantic helpers instead of
 * expo-haptics directly, so the haptics-enabled setting is enforced once and
 * unsupported devices no-op silently.
 */

function isEnabled(): boolean {
  return useSettingsStore.getState().hapticsEnabled;
}

async function safely(run: () => Promise<void>): Promise<void> {
  if (!isEnabled()) {
    return;
  }
  try {
    await run();
  } catch {
    // Haptics unsupported (simulator, some Android devices) — ignore.
  }
}

export const haptics = {
  lightTap: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  mediumTap: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavyTap: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  selection: () => safely(() => Haptics.selectionAsync()),
  success: () =>
    safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () =>
    safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
