import { CARD_BACK } from '../assets/cards.generated';
import { DECK_COVER_ART } from '../assets/registry';
import { effectiveDeckCover } from '../engine/dojo';
import { useDojoStore } from '../stores/dojoStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useModernUi } from './useModernUi';
import { useRouteMapId } from './useRouteMapId';

/**
 * The card back to deal on this route: in the Modern look, the casino's
 * colours of the chosen cover (or D until the casino has earned it); in
 * Classic, the original deck cover.
 */
export function useCardBack(): number {
  const modern = useModernUi();
  const mapId = useRouteMapId();
  const chosen = useSettingsStore((state) => state.deckCover);
  const cover = useDojoStore((state) => effectiveDeckCover(state.flashLevels, mapId, chosen));
  if (!modern) {
    return CARD_BACK;
  }
  return DECK_COVER_ART[cover][mapId] ?? CARD_BACK;
}
