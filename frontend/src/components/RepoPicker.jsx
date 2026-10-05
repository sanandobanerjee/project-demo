import { useRepos } from '../context/RepoContext.jsx';

// Two repositories can share a folder name, so fall back to the full path then.
function labelsFor(repos) {
  const counts = {};
  repos.forEach((r) => { counts[r.name] = (counts[r.name] || 0) + 1; });
  return Object.fromEntries(repos.map((r) => [r.id, counts[r.name] > 1 ? r.path : r.name]));
}

export default function RepoPicker() {
  const { repos, current, selectRepo } = useRepos();
  if (!current) return null;

  if (repos.length === 1) {
    return (
      <p className="repo-line">
        <span className="muted">Repository</span> <strong>{current.name}</strong>{' '}
        <span className="muted mono repo-path">{current.path}</span>
      </p>
    );
  }

  const labels = labelsFor(repos);
  return (
    <div className="repo-picker">
      <div className="field field--inline">
        <label htmlFor="repo-select">Repository</label>
        <select
          id="repo-select"
          value={current.id}
          onChange={(e) => selectRepo(repos.find((r) => String(r.id) === e.target.value))}
        >
          {repos.map((r) => (
            <option key={r.id} value={r.id}>
              {labels[r.id]}{r.last_scored_at ? '' : ' (not scored yet)'}
            </option>
          ))}
        </select>
      </div>
      <p className="muted mono repo-path">{current.path}</p>
    </div>
  );
}
