import { Redirect } from 'expo-router';
import React from 'react';
import { LUNA_LUXE } from '../engine/betting/casino';
import { useProgressionStore } from '../stores/progressionStore';

/**
 * Launch lands on Select Map at the newest casino: the ladder shows where
 * you are, the START flag breathes on the level to play next, and the table
 * button lights once the ladder is cleared. Everything else stacks on top.
 */
export default function HomeScreen() {
  const unlockedMapIds = useProgressionStore((state) => state.unlockedMapIds);
  const mapId = Math.max(LUNA_LUXE.id, ...unlockedMapIds);
  return <Redirect href={{ pathname: '/levels/[mapId]', params: { mapId: String(mapId) } }} />;
}
