import { TelemetryEntry, TelemetryState } from '../types/telemetry';
import { useCallback, useEffect, useState } from 'react';

import { telemetryStorage } from '../utils/telemetryStorage';

const MAX_ENTRIES = 100;

export const useTelemetry = () => {
  const [state, setState] = useState<TelemetryState>({
    isVisible: false,
    entries: [],
    maxEntries: MAX_ENTRIES
  });

  // Load initial state from localStorage
  useEffect(() => {
    const isVisible = telemetryStorage.getVisibility();
    const entries = telemetryStorage.getEntries();
    setState(prev => ({
      ...prev,
      isVisible,
      entries
    }));
  }, []);

  // Persist entries to localStorage whenever they change
  useEffect(() => {
    telemetryStorage.setEntries(state.entries);
  }, [state.entries]);

  const addEntry = useCallback((entry: Omit<TelemetryEntry, 'id' | 'timestamp'>) => {
    const newEntry: TelemetryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };

    setState(prev => {
      const newEntries = [newEntry, ...prev.entries];
      // Keep only the most recent entries up to maxEntries
      return {
        ...prev,
        entries: newEntries.slice(0, prev.maxEntries)
      };
    });
  }, []);

  const clearEntries = useCallback(() => {
    setState(prev => ({
      ...prev,
      entries: []
    }));
    telemetryStorage.clearEntries();
  }, []);

  const logRequest = useCallback((
    mode: 'baseline' | 'volam',
    query: string,
    parameters: { alpha: number; beta: number; gamma: number; k: number },
    responseTime: number,
    topKScores: number[],
    success: boolean,
    error?: string
  ) => {
    addEntry({
      mode,
      query,
      parameters,
      responseTime,
      topKScores,
      success,
      error
    });
  }, [addEntry]);

  return {
    entries: state.entries,
    isVisible: state.isVisible,
    logRequest,
    clearEntries
  };
};
