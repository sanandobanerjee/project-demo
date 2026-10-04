export const formatScore = (n) => n.toFixed(2);
export const formatPercent = (n) => `${Math.round(n * 100)}%`;

export function splitPath(path) {
  const clean = path.replace(/\\/g, '/');
  const i = clean.lastIndexOf('/');
  return i === -1 ? { dir: '', name: clean } : { dir: clean.slice(0, i + 1), name: clean.slice(i + 1) };
}

export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

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
