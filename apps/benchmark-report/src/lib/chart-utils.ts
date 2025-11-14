/**
 * Chart utility functions for consistent score formatting and display
 */

/**
 * Format a score for display (0-1 internal scale to 0-10 display scale)
 */
export const formatScore = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return 'N/A';
  return (score * 10).toFixed(2);
};

/**
 * Safely handle score values, ensuring they're in 0-1 range
 */
export const safeScore = (score: number | null | undefined): number => {
  if (score === null || score === undefined || isNaN(score)) return 0;
  return Math.max(0, Math.min(1, score)); // Clamp to 0-1
};

/**
 * Get color for a score (0-1 scale)
 */
export const getScoreColor = (score: number): string => {
  if (score >= 0.9) return 'hsl(142, 76%, 36%)'; // Green
  if (score >= 0.7) return 'hsl(47, 96%, 53%)';  // Yellow
  return 'hsl(0, 84%, 60%)';                      // Red
};

/**
 * Format score for Y-axis ticks (0-1 to 0-10)
 */
export const scoreTickFormatter = (value: number): string => {
  return (value * 10).toFixed(1);
};

/**
 * Get score distribution ranges for 0-1 scale
 */
export const getScoreDistributionRanges = () => {
  return `
    CASE
      WHEN weighted_score >= 0.9 THEN '9.0-10.0'
      WHEN weighted_score >= 0.8 THEN '8.0-9.0'
      WHEN weighted_score >= 0.7 THEN '7.0-8.0'
      WHEN weighted_score >= 0.6 THEN '6.0-7.0'
      WHEN weighted_score >= 0.5 THEN '5.0-6.0'
      ELSE '0.0-5.0'
    END as range
  `;
};

/**
 * Format tooltip value for scores
 */
export const formatTooltipScore = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return formatScore(numValue);
};

/**
 * Get chart colors for consistent theming
 */
export const getChartColors = () => ({
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
  chart1: 'hsl(var(--chart-1))',
  chart2: 'hsl(var(--chart-2))',
  chart3: 'hsl(var(--chart-3))',
  chart4: 'hsl(var(--chart-4))',
  chart5: 'hsl(var(--chart-5))',
});

/**
 * Generate colors for multiple data series
 */
export const generateSeriesColors = (count: number): string[] => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 60) % 360; // Spread colors around the color wheel
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }
  return colors;
};

/** Formatters */
export const currencyFormatter = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
};

export const durationFormatter = (ms: number | null | undefined): string => {
  if (ms === null || ms === undefined || isNaN(ms)) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem.toFixed(0)}s`;
};

export const tokenFormatter = (tokens: number | null | undefined): string => {
  if (tokens === null || tokens === undefined || isNaN(tokens)) return '—';
  return new Intl.NumberFormat().format(tokens);
};

/** Basic statistics */
export const computeQuantiles = (values: number[], quantiles: number[] = [0.25, 0.5, 0.75, 0.95]): number[] => {
  const xs = values.filter(v => typeof v === 'number' && !isNaN(v)).slice().sort((a, b) => a - b);
  if (xs.length === 0) return quantiles.map(() => NaN);
  const q = (p: number) => {
    const idx = (xs.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return xs[lo];
    const w = idx - lo;
    return xs[lo] * (1 - w) + xs[hi] * w;
  };
  return quantiles.map(q);
};

export interface HistogramBin {
  range: string; // label in 0–10 scale
  count: number;
  from: number; // 0–1
  to: number;   // 0–1
}

export const buildHistogram = (values: number[], bins = 10): HistogramBin[] => {
  const xs = values.filter(v => typeof v === 'number' && !isNaN(v)).map(v => Math.max(0, Math.min(1, v)));
  if (xs.length === 0 || bins <= 0) return [];
  const min = 0;
  const max = 1;
  const width = (max - min) / bins;
  const buckets: HistogramBin[] = Array.from({ length: bins }, (_, i) => {
    const from = min + i * width;
    const to = i === bins - 1 ? max : from + width;
    const label = `${(from * 10).toFixed(1)}–${(to * 10).toFixed(1)}`;
    return { range: label, count: 0, from, to };
  });
  for (const s of xs) {
    let idx = Math.floor((s - min) / width);
    if (idx >= bins) idx = bins - 1;
    buckets[idx].count += 1;
  }
  return buckets;
};
