// These weights mirror backend/app/services/scoring.py.
// The API returns raw values and a total, so we rebuild each factor's
// share of the total on the client to draw the breakdown bars.
export const FACTORS = [
  { key: 'churn', field: 'churn', label: 'Churn', weight: 0.3, color: 'var(--churn)' },
  { key: 'bugfix', field: 'bugfix_ratio', label: 'Bug fixes', weight: 0.5, color: 'var(--bugfix)' },
  { key: 'smell', field: 'smell_density', label: 'Smells', weight: 0.2, color: 'var(--smell)' },
];

export const LEVELS = { high: 'High', medium: 'Medium', low: 'Low' };

export function levelFor(score) {
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

function rangeOf(rows, field) {
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    if (row[field] < min) min = row[field];
    if (row[field] > max) max = row[field];
  }
  return { min, max };
}

// Adds rank, level and per-factor contribution (`parts`) to every ranked row.
export function withParts(rows) {
  const ranges = Object.fromEntries(FACTORS.map((f) => [f.key, rangeOf(rows, f.field)]));
  const sorted = [...rows].sort((a, b) => b.total_score - a.total_score);

  return sorted.map((row, index) => {
    const parts = {};
    let sum = 0;
    for (const f of FACTORS) {
      const { min, max } = ranges[f.key];
      const normalized = max === min ? 0 : (row[f.field] - min) / (max - min);
      parts[f.key] = f.weight * normalized;
      sum += parts[f.key];
    }
    // If scores were computed at different times the rebuilt sum can drift.
    // Rescale so the bar always adds up to the score the API reported.
    if (sum > 0 && Math.abs(sum - row.total_score) > 0.005) {
      const k = row.total_score / sum;
      for (const f of FACTORS) parts[f.key] *= k;
    }
    return { ...row, rank: index + 1, parts, level: levelFor(row.total_score) };
  });
}

export function dominantFactor(parts) {
  let best = null;
  for (const f of FACTORS) {
    if (parts[f.key] > 0 && (!best || parts[f.key] > parts[best.key])) best = f;
  }
  return best;
}
