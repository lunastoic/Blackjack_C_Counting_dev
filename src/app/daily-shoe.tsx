import React from 'react';
import { ShoeRunScreen } from '../components/training/ShoeRunScreen';

/** Today's shoe — the same shuffle for every player, dealt on Kepler Fortune's felt. */
export default function DailyShoeRoute() {
  return <ShoeRunScreen mapId={6} level={6} daily />;
}
