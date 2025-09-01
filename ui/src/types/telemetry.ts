export interface TelemetryEntry {
  id: string;
  timestamp: string;
  mode: 'baseline' | 'volam';
  query: string;
  parameters: {
    alpha: number;
    beta: number;
    gamma: number;
    k: number;
  };
  responseTime: number;
  topKScores: number[];
  success: boolean;
  error?: string;
}

export interface TelemetryState {
  isVisible: boolean;
  entries: TelemetryEntry[];
  maxEntries: number;
}
