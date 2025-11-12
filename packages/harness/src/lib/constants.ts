// ============================================================================
// CONSTANTS
// ============================================================================

export const TABLE_WIDTH = 60;
export const SCORE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 70,
  NEEDS_WORK: 60
} as const;

// Simple progress state and helpers
export const TOTAL_STAGES = 6;

export interface ProgressState {
  spinner: any;
  currentStage: number;
}
