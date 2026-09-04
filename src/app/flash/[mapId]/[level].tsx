import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { TrainingLevelScreen } from '../../../components/training/TrainingLevelScreen';
import { isFlashLevel } from '../../../engine/dojo';
import { mapById } from '../../../engine/betting/casino';
import { useDojoStore } from '../../../stores/dojoStore';
import { FLASH_DEBUG_AVAILABLE, useFlashDebugStore } from '../../../stores/flashDebugStore';

/** One training level at one casino, opened from the level map. */
export default function FlashLevelRoute() {
  const params = useLocalSearchParams<{ mapId: string; level: string }>();
  const mapId = Number(params.mapId);
  const level = Number(params.level);
  const unlocked = useDojoStore((state) =>
    Number.isInteger(mapId) && isFlashLevel(level) ? state.isFlashLevelUnlocked(mapId, level) : false,
  );
  const debugUnlockAll = useFlashDebugStore((state) => FLASH_DEBUG_AVAILABLE && state.unlockAll);

  if (!mapById(mapId) || !isFlashLevel(level)) {
    return <Redirect href="/" />;
  }
  if (!unlocked && !debugUnlockAll) {
    return <Redirect href={{ pathname: '/levels/[mapId]', params: { mapId: String(mapId) } }} />;
  }
  return <TrainingLevelScreen mapId={mapId} level={level} />;
}
