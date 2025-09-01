import { TelemetryEntry } from '../types/telemetry';

const TELEMETRY_VISIBILITY_KEY = 'volam-rag-telemetry-visible';
const TELEMETRY_ENTRIES_KEY = 'volam-rag-telemetry-entries';

export const telemetryStorage = {
  // Visibility persistence
  getVisibility(): boolean {
    try {
      const stored = localStorage.getItem(TELEMETRY_VISIBILITY_KEY);
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  },

  setVisibility(isVisible: boolean): void {
    try {
      localStorage.setItem(TELEMETRY_VISIBILITY_KEY, JSON.stringify(isVisible));
    } catch {
      // Silently fail if localStorage is not available
    }
  },

  // Entries persistence (optional - for future enhancement)
  getEntries(): TelemetryEntry[] {
    try {
      const stored = localStorage.getItem(TELEMETRY_ENTRIES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  setEntries(entries: TelemetryEntry[]): void {
    try {
      // Only store last 50 entries to avoid localStorage bloat
      const limitedEntries = entries.slice(-50);
      localStorage.setItem(TELEMETRY_ENTRIES_KEY, JSON.stringify(limitedEntries));
    } catch {
      // Silently fail if localStorage is not available
    }
  },

  clearEntries(): void {
    try {
      localStorage.removeItem(TELEMETRY_ENTRIES_KEY);
    } catch {
      // Silently fail if localStorage is not available
    }
  }
};
