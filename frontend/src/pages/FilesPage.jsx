import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { withParts } from '../lib/scoring.js';
import { formatDate, formatScore, splitPath } from '../lib/format.js';
import ScoreBar, { ScoreLegend } from '../components/ScoreBar.jsx';
import LevelTag from '../components/LevelTag.jsx';
import StateMessage from '../components/StateMessage.jsx';

const PAGE_SIZE = 50;

const SORTS = [
  { value: 'total_score', label: 'Score' },
  { value: 'churn', label: 'Churn' },
  { value: 'bugfix_ratio', label: 'Bug-fix share' },
  { value: 'smell_density', label: 'Smells' },
];

const LEVEL_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function FilesPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['ranked'], queryFn: api.rankedFiles });

  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('all');
  const [pythonOnly, setPythonOnly] = useState(false);
  const [sortBy, setSortBy] = useState('total_score');
  const [shown, setShown] = useState(PAGE_SIZE);

  const rows = useMemo(() => (data ? withParts(data) : []), [data]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((r) => (level === 'all' ? true : r.level === level))
      .filter((r) => (pythonOnly ? r.path.endsWith('.py') : true))
      .filter((r) => (needle ? r.path.toLowerCase().includes(needle) : true))
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [rows, search, level, pythonOnly, sortBy]);

  if (isLoading) return <StateMessage title="Loading files…" />;

  if (error) {
    return (
      <StateMessage
        tone="error"
        title="Couldn't load ranked files"
        action={<button type="button" className="btn btn--secondary" onClick={() => refetch()}>Try again</button>}
      >
        {error.message}
      </StateMessage>
    );
  }

  if (rows.length === 0) {
    return (
      <StateMessage
        title="No scores yet"
        action={<Link className="btn" to="/analyze">Analyze a repository</Link>}
      >
        Analyze a repository and score its files to see which ones need attention first.
      </StateMessage>
    );
  }

  const high = rows.filter((r) => r.level === 'high').length;
  const medium = rows.filter((r) => r.level === 'medium').length;
  const newest = rows.reduce((a, r) => (r.computed_at > a ? r.computed_at : a), rows[0].computed_at);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>
          {high > 0
            ? `${high} ${high === 1 ? 'file needs' : 'files need'} attention first`
            : 'No files are high risk right now'}
        </h1>
        <p className="lede">
          {rows.length.toLocaleString()} files scored, {high} high and {medium} medium. Scores compare
          files within this repository, so a high score means the file stands out among its neighbors.
          Last scored {formatDate(newest)}.
        </p>
      </div>

      <div className="toolbar">
        <div className="field field--inline">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShown(PAGE_SIZE); }}
            placeholder="Filter by file path"
          />
        </div>

        <div className="segmented" role="radiogroup" aria-labelledby="level-label">
          <span id="level-label" className="segmented-label">Level</span>
          <div className="segmented-options">
            {LEVEL_FILTERS.map((f) => (
              <label key={f.value} className={level === f.value ? 'is-active' : ''}>
                <input
                  type="radio"
                  name="level"
                  value={f.value}
                  checked={level === f.value}
                  onChange={() => { setLevel(f.value); setShown(PAGE_SIZE); }}
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        <div className="field field--inline">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <label className="check">
          <input type="checkbox" checked={pythonOnly} onChange={(e) => { setPythonOnly(e.target.checked); setShown(PAGE_SIZE); }} />
          Python files only
        </label>
      </div>

      <div className="panel">
        <div className="panel-head">
          <p className="muted">
            Showing {Math.min(shown, visible.length).toLocaleString()} of {visible.length.toLocaleString()}
          </p>
          <ScoreLegend />
        </div>

        {visible.length === 0 ? (
          <div className="panel-empty">No files match these filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="files">
              <thead>
                <tr>
                  <th className="col-rank num" scope="col">#</th>
                  <th scope="col">File</th>
                  <th className="col-bar" scope="col">Score breakdown</th>
                  <th className="col-score num" scope="col">Score</th>
                  <th className="col-level" scope="col">Level</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, shown).map((r) => {
                  const { dir, name } = splitPath(r.path);
                  return (
                    <tr key={r.file_id} onClick={() => navigate(`/files/${r.file_id}`)}>
                      <td className="col-rank num muted">{r.rank}</td>
                      <td className="col-file">
                        <Link to={`/files/${r.file_id}`} className="filelink">
                          <span className="path-dir">{dir}</span>
                          <span className="path-name">{name}</span>
                        </Link>
                      </td>
                      <td className="col-bar"><ScoreBar parts={r.parts} /></td>
                      <td className="col-score num">{formatScore(r.total_score)}</td>
                      <td className="col-level"><LevelTag level={r.level} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {visible.length > shown && (
          <div className="panel-foot">
            <button type="button" className="btn btn--secondary" onClick={() => setShown((n) => n + PAGE_SIZE)}>
              Show {Math.min(PAGE_SIZE, visible.length - shown)} more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
