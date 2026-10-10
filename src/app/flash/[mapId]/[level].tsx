import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { BusyTableScreen } from '../../../components/training/BusyTableScreen';
import { CancelGridScreen } from '../../../components/training/CancelGridScreen';
import { ChipRushScreen } from '../../../components/training/ChipRushScreen';
import { DivideMatchScreen } from '../../../components/training/DivideMatchScreen';
import { FlipPointScreen } from '../../../components/training/FlipPointScreen';
import { SwipeStrategyScreen } from '../../../components/training/SwipeStrategyScreen';
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
  const mode = trainingLevelSpec(mapId, level).mode;
  // A shoe the trainee plays (the bosses, Luna's table night) is not a drill.
  if (mode === 'shoeRun') {
    return <ShoeRunScreen mapId={mapId} level={level} />;
  }
  // Luna Luxe's Cancel Out is a board of cards, not a question stream.
  if (mode === 'cancelGrid') {
    return <CancelGridScreen mapId={mapId} level={level} />;
  }
  // The other mini-games: each is a board of its own, not a question stream.
  if (mode === 'swipeStrategy') {
    return <SwipeStrategyScreen mapId={mapId} level={level} />;
  }
  if (mode === 'divideMatch') {
    return <DivideMatchScreen mapId={mapId} level={level} />;
  }
  if (mode === 'chipRush') {
    return <ChipRushScreen mapId={mapId} level={level} />;
  }
  if (mode === 'flipPoint') {
    return <FlipPointScreen mapId={mapId} level={level} />;
  }
  if (mode === 'busyTable') {
    return <BusyTableScreen mapId={mapId} level={level} />;
  }
  return <TrainingLevelScreen mapId={mapId} level={level} />;
}
