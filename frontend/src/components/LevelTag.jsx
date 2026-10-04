import { LEVELS } from '../lib/scoring.js';

export default function LevelTag({ level }) {
  return <span className={`level level--${level}`}>{LEVELS[level]}</span>;
}
