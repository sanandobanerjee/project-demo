import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { useRepos } from '../context/RepoContext.jsx';
import { FACTORS, dominantFactor, levelFor, withParts } from '../lib/scoring.js';
import { describeFactor, describeSmell, formatDate, formatScore, splitPath } from '../lib/format.js';
import ScoreBar from '../components/ScoreBar.jsx';
import LevelTag from '../components/LevelTag.jsx';
import StateMessage from '../components/StateMessage.jsx';

const DRIVER_TEXT = {
  churn: 'Most of this score comes from churn. The file is rewritten often.',
  bugfix: 'Most of this score comes from bug fixes. A large share of changes to this file were fixes.',
  smell: 'Most of this score comes from code smells found in the file itself.',
};

export default function FileDetailPage() {
  const { id } = useParams();
  const { repos, current, selectRepo } = useRepos();
  const detail = useQuery({ queryKey: ['file', id], queryFn: () => api.fileBreakdown(id) });

  // The file knows which repository it belongs to. The ranked list for that
  // repository is needed to size each factor's share of the score.
  const repoId = detail.data?.repo_id;
  const ranked = useQuery({
    queryKey: ['ranked', repoId],
    queryFn: () => api.rankedFiles(repoId),
    enabled: repoId != null,
  });

  // Opening a file from another repository (a shared link, say) switches the
  // Files page to that repository too, so "Back" lands in the right place.
  useEffect(() => {
    if (repoId == null || current?.id === repoId) return;
    const repo = repos.find((r) => r.id === repoId);
    if (repo) selectRepo(repo);
  }, [repoId, current?.id, repos, selectRepo]);

  const rows = useMemo(() => (ranked.data ? withParts(ranked.data) : []), [ranked.data]);
  const row = rows.find((r) => String(r.file_id) === String(id));
  const repoName = repos.find((r) => r.id === repoId)?.name;

  const back = <Link className="backlink" to="/files">Back to all files</Link>;

  if (detail.isLoading) return <StateMessage title="Loading file…" />;

  if (detail.error) {
    const notFound = detail.error.status === 404;
    return (
      <div className="stack">
        {back}
        <StateMessage
          tone="error"
          title={notFound ? 'File not found' : "Couldn't load this file"}
          action={<Link className="btn btn--secondary" to="/files">Go to ranked files</Link>}
        >
          {notFound ? 'No file with this ID is in the database.' : detail.error.message}
        </StateMessage>
      </div>
    );
  }

  const { path, score, smells } = detail.data;
  const { dir, name } = splitPath(path);
  const level = score ? levelFor(score.total_score) : null;
  const driver = row ? dominantFactor(row.parts) : null;

  return (
    <div className="stack">
      {back}

      <div className="page-head">
        <h1 className="path-title">
          <span className="path-dir">{dir}</span>
          <span className="path-name">{name}</span>
        </h1>
        {repoName && <p className="muted">in {repoName}</p>}
      </div>

      {!score ? (
        <StateMessage
          title="This file has no score yet"
          action={<Link className="btn" to="/analyze">Go to Analyze</Link>}
        >
          Run “Score files” to include it in the ranking.
        </StateMessage>
      ) : (
        <section className="panel panel--pad" aria-labelledby="score-heading">
          <div className="score-hero">
            <div>
              <h2 id="score-heading" className="sr-only">Score</h2>
              <p className="score-big">{formatScore(score.total_score)}</p>
              <p className="muted">
                {row ? `Ranked ${row.rank} of ${rows.length.toLocaleString()}` : 'Score out of 1.00'}
              </p>
            </div>
            <LevelTag level={level} />
          </div>

          {row && (
            <>
              <ScoreBar parts={row.parts} size="lg" />
              {driver && <p className="driver">{DRIVER_TEXT[driver.key]}</p>}

              <table className="factors">
                <thead>
                  <tr>
                    <th scope="col">Factor</th>
                    <th scope="col">What we found</th>
                    <th scope="col" className="num">Adds to score</th>
                  </tr>
                </thead>
                <tbody>
                  {FACTORS.map((f) => (
                    <tr key={f.key}>
                      <th scope="row">
                        <span className="swatch" style={{ background: f.color }} aria-hidden="true" />
                        {f.label}
                        <span className="muted"> {Math.round(f.weight * 100)}%</span>
                      </th>
                      <td>{describeFactor(f.key, row)}</td>
                      <td className="num">+{formatScore(row.parts[f.key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {!row && ranked.isLoading && <p className="muted">Loading factor details…</p>}
          {!row && ranked.error && <p className="muted">Factor details are unavailable: {ranked.error.message}</p>}

          <p className="muted small">Scored {formatDate(score.computed_at)}</p>
        </section>
      )}

      <section aria-labelledby="smells-heading" className="stack stack--tight">
        <h2 id="smells-heading">Code smells</h2>
        {smells.length === 0 ? (
          <p className="muted">No smells were found in this file.</p>
        ) : (
          <ul className="smells">
            {smells.map((s, i) => {
              const info = describeSmell(s.smell_type);
              return (
                <li key={`${s.smell_type}-${s.line_number}-${i}`}>
                  <div className="smell-head">
                    <strong>{info.label}</strong>
                    <span className="muted mono">{s.line_number ? `line ${s.line_number}` : 'whole file'}</span>
                  </div>
                  {info.help && <p className="muted">{info.help}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
