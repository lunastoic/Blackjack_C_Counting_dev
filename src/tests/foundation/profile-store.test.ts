import { createDefaultSave } from '../../persistence/defaults';
import { sanitizeDisplayName, useProfileStore } from '../../stores/profileStore';

function resetProfile(): void {
  useProfileStore.getState().hydrate(createDefaultSave().profile);
}

describe('profile store', () => {
  beforeEach(resetProfile);

  it('defaults to "Player" with no creation timestamp', () => {
    expect(useProfileStore.getState().displayName).toBe('Player');
    expect(useProfileStore.getState().createdAt).toBeNull();
  });

  it('sets a trimmed display name and records creation time', () => {
    useProfileStore.getState().setDisplayName('  Ace Counter  ');
    expect(useProfileStore.getState().displayName).toBe('Ace Counter');
    expect(useProfileStore.getState().createdAt).not.toBeNull();
  });

  it('caps the name at 20 characters', () => {
    useProfileStore.getState().setDisplayName('A'.repeat(50));
    expect(useProfileStore.getState().displayName).toHaveLength(20);
  });

  it('falls back to the default name when the input is empty or whitespace', () => {
    useProfileStore.getState().setDisplayName('   ');
    expect(useProfileStore.getState().displayName).toBe('Player');
    useProfileStore.getState().setDisplayName('');
    expect(useProfileStore.getState().displayName).toBe('Player');
  });

  it('sanitizeDisplayName is pure and reusable', () => {
    expect(sanitizeDisplayName(' Neo ')).toBe('Neo');
    expect(sanitizeDisplayName('')).toBe('Player');
    expect(sanitizeDisplayName('x'.repeat(30))).toHaveLength(20);
  });

  it('preserves the original createdAt across renames', () => {
    useProfileStore.getState().hydrate({ displayName: 'Vega', createdAt: 12345 });
    useProfileStore.getState().setDisplayName('Altair');
    expect(useProfileStore.getState().createdAt).toBe(12345);
  });
});
