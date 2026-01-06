// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

/**
 * Format salary as currency ($X,XXX)
 */
export function formatSalary(salary: number): string {
  return `$${salary.toLocaleString()}`;
}

/**
 * Format percentage (e.g., 0.15 -> "15%")
 */
export function formatPercent(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format DK fantasy points
 */
export function formatDkPts(points: number | null): string {
  if (points === null) return '-';
  return points.toFixed(1);
}

/**
 * Format value (pts per $1000)
 */
export function formatValue(value: number | null): string {
  if (value === null) return '-';
  return value.toFixed(2);
}

/**
 * Format player name for display (truncate if needed)
 */
export function formatPlayerName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 1) + '…';
}

/**
 * Format date for display (MM/DD)
 */
export function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * Format date with year (MM/DD/YYYY)
 */
export function formatDateFull(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

/**
 * Format time (HH:MM AM/PM)
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format game matchup (e.g., "LAL@BOS")
 */
export function formatMatchup(
  team: string,
  opponent: string,
  isHome: boolean
): string {
  return isHome ? `${opponent}@${team}` : `${team}@${opponent}`;
}

/**
 * Get confidence badge color
 */
export function getConfidenceColor(
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
): string {
  switch (confidence) {
    case 'HIGH':
      return 'green';
    case 'MEDIUM':
      return 'yellow';
    case 'LOW':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get DVP color based on value (higher = easier matchup)
 */
export function getDvpColor(dvp: number | null): string {
  if (dvp === null) return 'gray';
  if (dvp >= 45) return 'green';
  if (dvp >= 40) return 'lime';
  if (dvp <= 35) return 'red';
  if (dvp <= 38) return 'orange';
  return 'gray';
}

/**
 * Get value color based on pts per $1000
 */
export function getValueColor(value: number | null): string {
  if (value === null) return 'gray';
  if (value >= 6.0) return 'green';
  if (value >= 5.5) return 'lime';
  if (value >= 5.0) return 'yellow';
  if (value < 4.0) return 'red';
  return 'gray';
}

/**
 * Format ordinal number (1st, 2nd, 3rd, etc.)
 */
export function formatOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  const suffix = s[(v - 20) % 10] ?? s[v] ?? s[0] ?? 'th';
  return n + suffix;
}

/**
 * Format large numbers with K/M suffix
 */
export function formatCompact(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}
