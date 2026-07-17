import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Single source of truth for reduced motion: the OS accessibility preference
 * OR the in-app override. All future animations must consult this hook (or
 * the store flag directly in non-React code).
 */
export function useReducedMotion(): boolean {
  const appOverride = useSettingsStore((state) => state.reducedMotion);
  const [osPreference, setOsPreference] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setOsPreference(enabled);
        }
      })
      .catch(() => {
        // Preference unavailable — assume motion is allowed.
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setOsPreference,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return osPreference || appOverride;
}
