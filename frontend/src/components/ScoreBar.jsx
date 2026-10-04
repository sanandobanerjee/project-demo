import { FACTORS } from '../lib/scoring.js';

// The full track represents a score of 1.00. Each colored segment is one
// factor's contribution, so the bar length is the score itself.
export default function ScoreBar({ parts, size = 'sm' }) {
  const label = FACTORS.map((f) => `${f.label} ${parts[f.key].toFixed(2)}`).join(', ');
  return (
    <div className={`scorebar scorebar--${size}`} role="img" aria-label={label} title={label}>
      {FACTORS.map((f) => (
        <span
          key={f.key}
          className="scorebar-seg"
          style={{ width: `${Math.max(0, parts[f.key]) * 100}%`, background: f.color }}
        />
      ))}
    </div>
  );
}

export function ScoreLegend() {
  return (
    <ul className="legend" aria-label="Score factors">
      {FACTORS.map((f) => (
        <li key={f.key}>
          <span className="swatch" style={{ background: f.color }} aria-hidden="true" />
          {f.label} <span className="muted">{Math.round(f.weight * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}
