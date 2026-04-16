/**
 * Safe localStorage utilities for 22YARDS
 * Centralizes all localStorage access with error handling, size validation,
 * and a migration-ready key registry.
 */

// âââ Key Registry âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// All localStorage keys used by the app. Centralizing them prevents typos
// and makes it easy to audit what data is stored.
export const STORAGE_KEYS = {
  ACTIVE_MATCH: '22YARDS_ACTIVE_MATCH',
  USER_DATA: '22YARDS_USER_DATA',
  GLOBAL_VAULT: '22YARDS_GLOBAL_VAULT',
  THEME: '22YARDS_THEME',
  FOLLOWING_MATCH: '22Y_FOLLOWING_MATCH',
  // Dynamic keys (constructed with match ID):
  // TRANSFER_ACCEPTED: `22Y_TRANSFER_ACCEPTED_${matchId}`
  // I_AM_SCORER: `22Y_I_AM_SCORER_${matchId}` (sessionStorage)
} as const;

// âââ Size Check âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const MAX_SAFE_SIZE = 4 * 1024 * 1024; // 4MB â leave 1MB headroom from typical 5MB limit

function getStorageUsedBytes(): number {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        total += key.length + (localStorage.getItem(key)?.length ?? 0);
      }
    }
  } catch {
    // Ignore â quota exceeded even during measurement means we're over
  }
  return total * 2; // JS strings are UTF-16, so 2 bytes per char
}

export function isStorageNearFull(thresholdPercent = 80): boolean {
  const used = getStorageUsedBytes();
  return used >= (MAX_SAFE_SIZE * thresholdPercent) / 100;
}

// âââ Safe Read âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export function safeGetItem<T = unknown>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`[22Y Storage] Failed to read key "${key}":`, e);
    return fallback;
  }
}

export function safeGetString(key: string, fallback: string = ''): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

// âââ Safe Write âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export function safeSetItem(key: string, value: unknown): boolean {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (e) {
    console.error(`[22Y Storage] Failed to write key "${key}":`, e);
    // QuotaExceededError â try to free space and retry once
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[22Y Storage] Quota exceeded, attempting cleanup...');
      pruneOldVaultEntries();
      try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, serialized);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

// âââ Safe Remove âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Swallow â nothing to do if remove fails
  }
}

// âââ Vault Pruning (emergency quota relief) âââââââââââââââââââââââââââââââ
// When storage is full, trim the oldest match records from GLOBAL_VAULT.
function pruneOldVaultEntries(maxRecordsPerPlayer = 20): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GLOBAL_VAULT);
    if (!raw) return;
    const vault = JSON.parse(raw);
    let pruned = false;
    for (const phone of Object.keys(vault)) {
      const entry = vault[phone];
      if (entry?.history && Array.isArray(entry.history) && entry.history.length > maxRecordsPerPlayer) {
        // Keep only the most recent N records
        entry.history = entry.history.slice(-maxRecordsPerPlayer);
        pruned = true;
      }
    }
    if (pruned) {
      localStorage.setItem(STORAGE_KEYS.GLOBAL_VAULT, JSON.stringify(vault));
      console.log('[22Y Storage] Pruned vault to free space');
    }
  } catch {
    // If even pruning fails, nothing more we can do
  }
}

// âââ Session Storage helpers (for scorer flags) ââââââââââââââââââââââââââ
export function safeSessionGet<T = unknown>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeSessionSet(key: string, value: unknown): boolean {
  try {
    sessionStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function safeSessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Swallow
  }
}
