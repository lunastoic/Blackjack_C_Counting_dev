import { Redirect } from 'expo-router';
import React from 'react';
import { useProgressionStore } from '../stores/progressionStore';

/**
 * There is no home screen: the app boots straight onto a live table. The
 * player lands at the best casino they have unlocked (fresh installs land at
 * Luna Luxe) with the Count Coach at whatever level they last chose; the
 * in-game globe switches maps and the ≡ dropdown tunes the coach.
 * The root LoadingGate guarantees the save is hydrated before this renders.
 */
export default function BootRedirect() {
  const unlockedMapIds = useProgressionStore((state) => state.unlockedMapIds);
  const bestMapId = unlockedMapIds.length > 0 ? Math.max(...unlockedMapIds) : 1;

  return <Redirect href={{ pathname: '/game/[mapId]', params: { mapId: String(bestMapId) } }} />;
}
