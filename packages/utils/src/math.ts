// =============================================================================
// MATH UTILITIES
// =============================================================================

/**
 * Calculate average of an array of numbers
 */
export function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate weighted average
 */
export function weightedAvg(
  values: number[],
  weights: number[]
): number {
  if (values.length === 0 || values.length !== weights.length) return 0;
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) return 0;
  return (
    values.reduce((sum, val, i) => sum + val * (weights[i] ?? 0), 0) / weightSum
  );
}

/**
 * Calculate standard deviation
 */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = avg(values);
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(avg(squaredDiffs));
}

/**
 * Calculate coefficient of variation (volatility)
 */
export function coefficientOfVariation(values: number[]): number {
  const mean = avg(values);
  if (mean === 0) return 0;
  return stdDev(values) / mean;
}

/**
 * Calculate percentile value from sorted array
 */
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const lowerValue = sortedValues[lower] ?? 0;
  const upperValue = sortedValues[upper] ?? 0;
  return lowerValue + (upperValue - lowerValue) * (index - lower);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Round to specified decimal places
 */
export function round(value: number, decimals: number = 1): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Calculate mean absolute error
 */
export function meanAbsoluteError(
  predicted: number[],
  actual: number[]
): number {
  if (predicted.length !== actual.length || predicted.length === 0) return 0;
  const errors = predicted.map((p, i) => Math.abs(p - (actual[i] ?? 0)));
  return avg(errors);
}

/**
 * Calculate root mean square error
 */
export function rmse(predicted: number[], actual: number[]): number {
  if (predicted.length !== actual.length || predicted.length === 0) return 0;
  const squaredErrors = predicted.map((p, i) =>
    Math.pow(p - (actual[i] ?? 0), 2)
  );
  return Math.sqrt(avg(squaredErrors));
}

/**
 * Calculate R-squared (coefficient of determination)
 */
export function rSquared(predicted: number[], actual: number[]): number {
  if (predicted.length !== actual.length || predicted.length < 2) return 0;
  const actualMean = avg(actual);
  const ssRes = predicted.reduce(
    (sum, p, i) => sum + Math.pow((actual[i] ?? 0) - p, 2),
    0
  );
  const ssTot = actual.reduce(
    (sum, a) => sum + Math.pow(a - actualMean, 2),
    0
  );
  if (ssTot === 0) return 0;
  return 1 - ssRes / ssTot;
}
