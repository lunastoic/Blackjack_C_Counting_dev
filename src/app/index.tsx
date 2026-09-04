import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import { TrainingLevelScreen } from '../components/training/TrainingLevelScreen';
import { LUNA_LUXE } from '../engine/betting/casino';
import { useDojoStore } from '../stores/dojoStore';

/**
 * Launch lands you straight at the Luna Luxe table on the next training
 * level — no intro, no questions, just Start. Once all six are cleared the
 * table itself is home.
 *
 * The level is captured once per mount so clearing it shows the results card
 * instead of instantly re-pointing the table at the next level.
 */
export default function HomeScreen() {
  const [level] = useState(() => useDojoStore.getState().nextFlashLevel(LUNA_LUXE.id));

  if (level === null) {
    return <Redirect href={{ pathname: '/game/[mapId]', params: { mapId: String(LUNA_LUXE.id) } }} />;
  }
  return <TrainingLevelScreen mapId={LUNA_LUXE.id} level={level} />;
}
