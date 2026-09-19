import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ShoeRunScreen } from '../../../components/training/ShoeRunScreen';
import { TrainingLevelScreen } from '../../../components/training/TrainingLevelScreen';
import {
  isShoeRunDrill,
  mapForDrill,
  PREVIEW_DRILL_IDS,
  PreviewDrillId,
} from '../../../engine/dojo';

/** A preview drill off a money bag — the taste of the next casino's skill. */
export default function PreviewDrillRoute() {
  const { drillId } = useLocalSearchParams<{ drillId: string }>();
  const drill = PREVIEW_DRILL_IDS.find((id) => id === drillId) as PreviewDrillId | undefined;
  if (!drill) {
    return <Redirect href="/" />;
  }
  // Dealt on the felt of the casino whose bag carried it.
  const mapId = mapForDrill(drill);
  return isShoeRunDrill(drill) ? (
    <ShoeRunScreen mapId={mapId} level={6} drill={drill} />
  ) : (
    <TrainingLevelScreen mapId={mapId} level={1} drill={drill} />
  );
}
