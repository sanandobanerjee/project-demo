import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api.js';
import { useRepos } from '../context/RepoContext.jsx';
import { formatDate, formatPercent } from '../lib/format.js';
import RepoPicker from '../components/RepoPicker.jsx';
import StateMessage from '../components/StateMessage.jsx';

const RESULT_ROWS = [
  { key: 'our_score_hit_rate', label: 'Combined score', note: 'Churn, bug fixes and smells together', strong: true },
  { key: 'smell_only_baseline_hit_rate', label: 'Smells only', note: 'Rank by smell count alone' },
  { key: 'churn_only_baseline_hit_rate', label: 'Churn only', note: 'Rank by lines changed alone' },
];

function verdict(r) {
  if (r.bugfix_files_after_cutoff === 0) {
    return 'No files received bug fixes after this date, so there is nothing to measure. Try an earlier cutoff.';
  }
  const ours = r.our_score_hit_rate;
  const best = Math.max(r.smell_only_baseline_hit_rate, r.churn_only_baseline_hit_rate);
  if (ours > best) return 'The combined score found more of the later bug-fixed files than either simpler ranking.';
  if (ours === best) return 'The combined score did as well as the best simpler ranking, but no better.';
  return 'A simpler ranking found more of the later bug-fixed files than the combined score did.';
}

export default function BacktestPage() {
  const { current, isLoading, error, refetch } = useRepos();

  if (isLoading) return <StateMessage title="Loading…" />;

  if (error) {
    return (
      <StateMessage
        tone="error"
        title="Couldn't load repositories"
        action={<button type="button" className="btn btn--secondary" onClick={() => refetch()}>Try again</button>}
      >
        {error.message}
      </StateMessage>
    );
  }

  if (!current) {
    return (
      <StateMessage
        title="Nothing to test yet"
        action={<Link className="btn" to="/analyze">Analyze a repository</Link>}
      >
        A backtest replays a repository’s history, so analyze one first.
      </StateMessage>
    );
  }

  // Keyed by repository so a previous result never sits under another repository's name.
  return <BacktestForm key={current.id} repo={current} />;
}

function BacktestForm({ repo }) {
  const [cutoff, setCutoff] = useState('');
  const [topPercent, setTopPercent] = useState(10);
  const mutation = useMutation({ mutationFn: api.runBacktest });

  function submit(e) {
    e.preventDefault();
    if (!cutoff) return;
    // The date picker is in the viewer's local time. Send it to the API as UTC.
    mutation.mutate({ cutoff: new Date(cutoff).toISOString(), topPercent: topPercent / 100, repoId: repo.id });
  }

  const result = mutation.data;

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Backtest the ranking</h1>
        <p className="lede">
          Pick a date in the past. Debt Scope ranks files using only the history up to that date, then
          checks how many of the files that received bug fixes afterwards landed in your top group.
        </p>
        <RepoPicker />
      </div>

      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="cutoff">Cutoff date and time</label>
          <input id="cutoff" type="datetime-local" value={cutoff} onChange={(e) => setCutoff(e.target.value)} required />
          <p className="hint">Uses your local time zone. Pick a date with plenty of history on both sides.</p>
        </div>

        <div className="field">
          <label htmlFor="top-percent">
            Top group size: <strong>{topPercent}%</strong> of files
          </label>
          <input
            id="top-percent"
            type="range"
            min="5"
            max="50"
            step="5"
            value={topPercent}
            onChange={(e) => setTopPercent(Number(e.target.value))}
          />
        </div>

        <div className="actions">
          <button type="submit" className="btn" disabled={!cutoff || mutation.isPending}>
            {mutation.isPending ? 'Running…' : 'Run backtest'}
          </button>
        </div>
      </form>

      {mutation.isError && (
        <div className="state state--error" role="alert">
          <p className="state-title">Backtest failed</p>
          <p className="state-body">{mutation.error.message}</p>
        </div>
      )}

      {result && (
        <section className="panel panel--pad" aria-labelledby="result-heading">
          <h2 id="result-heading">Results</h2>
          <p className="muted">
            {repo.name}, with history up to {formatDate(result.cutoff)}.
          </p>
          <p className="driver">{verdict(result)}</p>

          {result.bugfix_files_after_cutoff > 0 && (
            <>
              <p className="muted">
                Share of the {result.bugfix_files_after_cutoff.toLocaleString()} later bug-fixed files
                found in the top {formatPercent(result.top_percent)} of {result.files_considered.toLocaleString()} files:
              </p>
              <ul className="bars">
                {RESULT_ROWS.map((row) => {
                  const value = result[row.key];
                  return (
                    <li key={row.key}>
                      <div className="bars-label">
                        <strong>{row.label}</strong>
                        <span className="muted">{row.note}</span>
                      </div>
                      <div className="bars-track" role="img" aria-label={`${row.label}: ${formatPercent(value)}`}>
                        <span className={`bars-fill ${row.strong ? 'bars-fill--strong' : ''}`} style={{ width: `${value * 100}%` }} />
                      </div>
                      <span className="bars-value num">{formatPercent(value)}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
