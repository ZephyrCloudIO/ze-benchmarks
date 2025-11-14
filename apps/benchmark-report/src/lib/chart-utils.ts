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
