import { useSettingsStore } from '../stores/settingsStore';

/**
 * True when the Look setting is Modern — the arcade intros and bevelled
 * buttons drawn in code. False keeps the Classic assets. Every component with
 * both looks branches on this so the switch takes effect everywhere at once.
 */
export function useModernUi(): boolean {
  return useSettingsStore((state) => state.uiStyle === 'modern');
}
