export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function mergeConfidence(values: string[]): "low" | "medium" | "high" {
  const score: Record<string, number> = { low: 1, medium: 2, high: 3 };
  const average = values.reduce((sum, value) => sum + (score[value] ?? 1), 0) /
    Math.max(values.length, 1);
  if (average >= 2.5) return "high";
  if (average >= 1.5) return "medium";
  return "low";
}
