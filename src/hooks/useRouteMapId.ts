import { useLocalSearchParams } from 'expo-router';
import { LUNA_LUXE, mapById } from '../engine/betting/casino';

/**
 * The casino the current route belongs to — its `[mapId]` segment (the
 * table, the quiz, the ladder, a flash level). Routes without one (the
 * drills, Learn, Settings) read as Luna Luxe, so their cards and chrome wear
 * the house colours.
 */
export function useRouteMapId(): number {
  const { mapId } = useLocalSearchParams<{ mapId?: string }>();
  const parsed = Number(mapId);
  return Number.isInteger(parsed) && mapById(parsed) ? parsed : LUNA_LUXE.id;
}
