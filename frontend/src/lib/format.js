export const formatScore = (n) => n.toFixed(2);
export const formatPercent = (n) => `${Math.round(n * 100)}%`;

// ---------- Paths ----------
// Windows paths use backslashes, Linux and macOS use slashes. Everything the UI
// shows or searches goes through normalizePath so "app/api" always matches
// regardless of the platform the backend ran on.
export const normalizePath = (path) => path.replace(/\\/g, '/');

export function splitPath(path) {
  const clean = normalizePath(path);
  const i = clean.lastIndexOf('/');
  return i === -1 ? { dir: '', name: clean } : { dir: clean.slice(0, i + 1), name: clean.slice(i + 1) };
}

export function matchesPath(path, query) {
  const needle = normalizePath(query.trim()).toLowerCase();
  if (!needle) return true;
  return normalizePath(path).toLowerCase().includes(needle);
}

// Lenient comparison for folder paths typed by a person.
export const comparablePath = (path) =>
  normalizePath(path.trim().replace(/^["']|["']$/g, ''))
    .replace(/\/+$/, '')
    .toLowerCase();

// ---------- Dates ----------
// The API sends UTC. Older responses had no "Z" suffix, and browsers read a
// suffix-less timestamp as local time, which showed UTC clock times as if they
// were local. Treat anything without a zone as UTC, then show it in the
// viewer's own time zone.
export function parseApiDate(value) {
  if (!value) return null;
  let text = String(value).trim();
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(text)) text += 'Z';
  text = text.replace(/(\.\d{3})\d+/, '$1'); // some browsers reject microseconds
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

const DATE_TIME = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
};

export function formatDate(value) {
  const date = parseApiDate(value);
  return date ? date.toLocaleString(undefined, DATE_TIME) : String(value ?? '');
}

// ---------- Smells and factors ----------
const SMELLS = {
  high_cyclomatic_complexity: {
    label: 'Function is too complex',
    help: 'This function has many branches and paths. Splitting it into smaller functions makes it easier to test.',
  },
  low_maintainability_index: {
    label: 'File is hard to maintain',
    help: 'The file scores low on the maintainability index, which usually means long, dense or deeply nested code.',
  },
};

export function describeSmell(type) {
  if (SMELLS[type]) return SMELLS[type];
  const label = type.replace(/_/g, ' ');
  return { label: label.charAt(0).toUpperCase() + label.slice(1), help: '' };
}

export function describeFactor(key, row) {
  if (key === 'churn') return `${Math.round(row.churn).toLocaleString()} lines added or removed`;
  if (key === 'bugfix') return `${formatPercent(row.bugfix_ratio)} of changes were bug fixes`;
  const n = Math.round(row.smell_density);
  return `${n} ${n === 1 ? 'smell' : 'smells'} found`;
}
