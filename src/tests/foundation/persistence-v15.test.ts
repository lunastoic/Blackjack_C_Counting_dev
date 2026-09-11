import { createDefaultSave } from '../../persistence/defaults';
import { MIGRATIONS, runMigrations } from '../../persistence/migrations';
import { saveDataSchema, settingsSchema } from '../../persistence/schema';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Schema v15: the plain card deck is a setting (`settings.cardDeck`). A v14
 * save gains the default Public Domain Deck; nothing else moves.
 */

function v14Save(): Record<string, unknown> {
  const save = createDefaultSave() as unknown as Record<string, unknown>;
  const { cardDeck: _cardDeck, ...settings } = save.settings as Record<string, unknown>;
  return { ...save, settings };
}

describe('v14 → v15 migration', () => {
  it('is registered', () => {
    expect(MIGRATIONS[14]).toBeDefined();
  });

  it('defaults the deck and keeps the rest', () => {
    const original = v14Save();
    expect((original.settings as Record<string, unknown>).cardDeck).toBeUndefined();

    const parsed = saveDataSchema.parse(runMigrations(original, 14));

    expect(parsed.settings.cardDeck).toBe('regular');
    expect(parsed.settings).toEqual({ ...(original.settings as object), cardDeck: 'regular' });
    expect(parsed.economy).toEqual(original.economy);
    expect(parsed.progression).toEqual(original.progression);
    expect(parsed.dojo).toEqual(original.dojo);
  });

  it('only knows the two plain decks', () => {
    const settings = createDefaultSave().settings;
    expect(() => settingsSchema.parse({ ...settings, cardDeck: 'luna' })).not.toThrow();
    expect(() => settingsSchema.parse({ ...settings, cardDeck: 'training' })).toThrow();
  });
});

describe('card deck setting', () => {
  beforeEach(() => {
    useSettingsStore.getState().hydrate(createDefaultSave().settings);
  });

  it('starts on the Public Domain Deck and switches to Luna', () => {
    expect(useSettingsStore.getState().cardDeck).toBe('regular');
    useSettingsStore.getState().setCardDeck('luna');
    expect(useSettingsStore.getState().cardDeck).toBe('luna');
  });

  it('ignores unknown decks and falls back on hydrate', () => {
    useSettingsStore.getState().setCardDeck('luna');
    useSettingsStore.getState().setCardDeck('training' as never);
    expect(useSettingsStore.getState().cardDeck).toBe('luna');

    useSettingsStore
      .getState()
      .hydrate({ ...createDefaultSave().settings, cardDeck: 'nope' as never });
    expect(useSettingsStore.getState().cardDeck).toBe('regular');
  });
});
