/**
 * Explicit AsyncStorage keys. The whole save lives in ONE versioned document
 * so migrations stay atomic (a partial multi-key write can never mix schema
 * versions). Save data is tiny (<10 KB), so single-document writes are cheap.
 */
export const STORAGE_KEYS = {
  save: 'bcc/save',
} as const;
