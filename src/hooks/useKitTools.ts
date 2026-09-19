import { useDojoStore } from '../stores/dojoStore';
import { useSettingsStore } from '../stores/settingsStore';
import { KIT_TOOL_IDS, KitToolId, mapForTool, rewardKey } from '../engine/dojo';

export type KitTools = Readonly<Record<KitToolId, boolean>>;

/**
 * The counter's kit as the table sees it: a tool is on once its casino's
 * gift has been opened, unless the player has switched it off. Nothing here
 * depends on the Count Coach dial — these are the player's own aids.
 */
export function useKitTools(): KitTools {
  const opened = useDojoStore((state) => state.rewardsOpened);
  const switches = useSettingsStore((state) => state.kitTools);
  return Object.fromEntries(
    KIT_TOOL_IDS.map((id) => [id, opened.has(rewardKey(mapForTool(id), 1)) && switches[id] !== false]),
  ) as KitTools;
}

/** Whether a tool has been won at all — the kit list shows the rest wrapped. */
export function useKitEarned(): KitTools {
  const opened = useDojoStore((state) => state.rewardsOpened);
  return Object.fromEntries(
    KIT_TOOL_IDS.map((id) => [id, opened.has(rewardKey(mapForTool(id), 1))]),
  ) as KitTools;
}
