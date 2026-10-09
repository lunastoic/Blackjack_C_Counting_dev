import { useDojoStore } from '../stores/dojoStore';
import { useSettingsStore } from '../stores/settingsStore';
import {
  FlashProgress,
  isRewardEarned,
  KIT_TOOL_IDS,
  KitToolId,
  mapForTool,
  rewardKey,
} from '../engine/dojo';

export type KitTools = Readonly<Record<KitToolId, boolean>>;

/**
 * A tool is earned by clearing its casino's level 1 (the gift there now holds
 * a card back). A gift opened before that change still counts.
 */
function isToolEarned(progress: FlashProgress, opened: ReadonlySet<string>, id: KitToolId): boolean {
  const mapId = mapForTool(id);
  return isRewardEarned(progress, mapId, 1) || opened.has(rewardKey(mapId, 1));
}

/**
 * The counter's kit as the table sees it: a tool is on once it is earned,
 * unless the player has switched it off. Nothing here depends on the Count
 * Coach dial — these are the player's own aids.
 */
export function useKitTools(): KitTools {
  const progress = useDojoStore((state) => state.flashLevels);
  const opened = useDojoStore((state) => state.rewardsOpened);
  const switches = useSettingsStore((state) => state.kitTools);
  return Object.fromEntries(
    KIT_TOOL_IDS.map((id) => [id, isToolEarned(progress, opened, id) && switches[id] !== false]),
  ) as KitTools;
}

/** Whether a tool has been won at all — the kit list shows the rest wrapped. */
export function useKitEarned(): KitTools {
  const progress = useDojoStore((state) => state.flashLevels);
  const opened = useDojoStore((state) => state.rewardsOpened);
  return Object.fromEntries(
    KIT_TOOL_IDS.map((id) => [id, isToolEarned(progress, opened, id)]),
  ) as KitTools;
}
