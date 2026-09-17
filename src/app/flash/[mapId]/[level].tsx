import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ShoeRunScreen } from '../../../components/training/ShoeRunScreen';
import { TrainingLevelScreen } from '../../../components/training/TrainingLevelScreen';
import { isFlashLevel, trainingLevelSpec } from '../../../engine/dojo';
import { mapById } from '../../../engine/betting/casino';
import { useDojoStore } from '../../../stores/dojoStore';
import { FLASH_DEBUG_AVAILABLE, useFlashDebugStore } from '../../../stores/flashDebugStore';
import { useProgressionStore } from '../../../stores/progressionStore';

/** One training level at one casino, opened from the level map. */
export default function FlashLevelRoute() {
  const params = useLocalSearchParams<{ mapId: string; level: string }>();
  const mapId = Number(params.mapId);
  const level = Number(params.level);
  // A level opens with its casino (earned or bought), then in ladder order.
  const mapUnlocked = useProgressionStore((state) => state.isMapUnlocked(mapId));
  const unlocked = useDojoStore((state) =>
    Number.isInteger(mapId) && isFlashLevel(level) ? state.isFlashLevelUnlocked(mapId, level) : false,
  );
  const debugUnlockAll = useFlashDebugStore((state) => FLASH_DEBUG_AVAILABLE && state.unlockAll);

  if (!mapById(mapId) || !isFlashLevel(level)) {
    return <Redirect href="/" />;
  }
  if (!(mapUnlocked && unlocked) && !debugUnlockAll) {
    return <Redirect href={{ pathname: '/levels/[mapId]', params: { mapId: String(mapId) } }} />;
  }
  // Each casino's boss is a shoe the trainee plays, not a drill.
  if (trainingLevelSpec(mapId, level).mode === 'shoeRun') {
    return <ShoeRunScreen mapId={mapId} level={level} />;
  }
  return <TrainingLevelScreen mapId={mapId} level={level} />;
}
