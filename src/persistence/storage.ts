import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDefaultSave } from './defaults';
import { STORAGE_KEYS } from './keys';
import { runMigrations } from './migrations';
import { SAVE_SCHEMA_VERSION, SaveData, saveDataSchema, saveEnvelopeSchema } from './schema';

export interface LoadResult {
  readonly save: SaveData;
  /** Set when stored data was missing/corrupt and defaults were used. Null on clean loads. */
  readonly recoveredFrom: string | null;
  /** True when this is a fresh install (nothing was stored). */
  readonly isFreshInstall: boolean;
}

/**
 * Loads and validates the save. Never throws and never crashes the app:
 * corrupt JSON, invalid schema, or failed migrations all fall back to a
 * default save, preserving a readable reason for development logging.
 */
export async function loadSave(): Promise<LoadResult> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEYS.save);
  } catch (error) {
    return recover(`AsyncStorage read failed: ${describe(error)}`);
  }

  if (raw === null) {
    return { save: createDefaultSave(), recoveredFrom: null, isFreshInstall: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return recover(`Stored save is not valid JSON: ${describe(error)}`);
  }

  const envelope = saveEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) {
    return recover(`Save envelope failed validation: ${envelope.error.message}`);
  }

  let migrated: unknown;
  try {
    migrated = runMigrations(envelope.data.data, envelope.data.version);
  } catch (error) {
    return recover(`Migration failed: ${describe(error)}`);
  }

  const data = saveDataSchema.safeParse(migrated);
  if (!data.success) {
    return recover(`Save data failed validation: ${data.error.message}`);
  }

  return { save: data.data, recoveredFrom: null, isFreshInstall: false };
}

function recover(reason: string): LoadResult {
  if (__DEV__) {
    console.warn(`[persistence] Falling back to default save. ${reason}`);
  }
  return { save: createDefaultSave(), recoveredFrom: reason, isFreshInstall: false };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Writes the save inside the versioned envelope. Failures are logged, never thrown. */
export async function writeSave(data: SaveData): Promise<boolean> {
  try {
    const envelope = {
      version: SAVE_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      data,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.save, JSON.stringify(envelope));
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn(`[persistence] Save write failed: ${describe(error)}`);
    }
    return false;
  }
}

/** Deletes the stored save (development reset / corrupted-state recovery). */
export async function resetSave(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.save);
  } catch (error) {
    if (__DEV__) {
      console.warn(`[persistence] Save reset failed: ${describe(error)}`);
    }
  }
}
