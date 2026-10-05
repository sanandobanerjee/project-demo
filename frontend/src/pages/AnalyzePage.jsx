import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { useRepos } from '../context/RepoContext.jsx';
import { comparablePath, formatDate } from '../lib/format.js';

const STORE_KEY = 'debtscope.pipeline.v2';

const STEPS = [
  {
    key: 'git',
    title: 'Read Git history',
    description:
      'Walks every commit and records which files it changed, how many lines were added and removed, and whether the message mentions a fix (words like fix, bug or patch). Commits that were already loaded are skipped, so it is safe to run again.',
    run: (path) => api.ingestGit(path),
    summarize: (res) =>
      res.commits_processed === 0
        ? 'No new commits. This history was already loaded.'
        : `${res.commits_processed.toLocaleString()} new commits read.`,
  },
  {
    key: 'analysis',
    title: 'Find code smells',
    description:
      'Scans each Python file and flags functions with a cyclomatic complexity above 10, and files with a maintainability index below 65. Other file types are skipped. Running it again replaces the earlier results for this repository.',
    run: (path) => api.ingestAnalysis(path),
    summarize: (res) => `${res.smells_created.toLocaleString()} smells found.`,
  },
  {
    key: 'scores',
    title: 'Score files',
    description:
      'Scales churn, bug-fix share and smell count between 0 and 1 across this repository’s files, then combines them: 30% churn, 50% bug fixes, 20% smells. Each run adds a fresh score, and the newest one is what you see.',
    run: (_path, repoId) => api.computeScores(repoId),
    summarize: (res) => `${res.length.toLocaleString()} files scored.`,
  },
];

const idle = () => Object.fromEntries(STEPS.map((s) => [s.key, { status: 'idle', message: '' }]));
const blank = () => ({ repoPath: '', repoId: null, steps: idle() });

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!saved) return blank();
    const steps = idle();
    for (const s of STEPS) {
      const item = saved.steps?.[s.key];
      if (item && (item.status === 'done' || item.status === 'error')) steps[s.key] = item;
    }
    return { repoPath: saved.repoPath ?? '', repoId: saved.repoId ?? null, steps };
  } catch {
    return blank();
  }
}

function save(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable, the page still works */
  }
}

function friendlyError(step, err) {
  const msg = err.message;
  const alreadyClear = /^Folder not found|hasn't been read yet/.test(msg);
  if (err.status === 400 && step.key !== 'scores' && !alreadyClear) {
    return `Couldn’t read that repository. Check that the folder is a Git repository with its full history, not a shallow clone.\n\nDetails: ${msg}`;
  }
  return msg;
}

export default function AnalyzePage() {
  const queryClient = useQueryClient();
  const { repos, isLoading: reposLoading, error: reposError, selectRepo } = useRepos();
  const [state, setState] = useState(loadSaved);
  const { repoPath, repoId, steps } = state;
  const busy = STEPS.some((s) => steps[s.key].status === 'running');

  function update(fn) {
    setState((prev) => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }

  // The API database is rebuilt whenever the backend restarts. If saved progress
  // points at a repository the API no longer has, start over instead of showing
  // steps as done that have to be run again.
  useEffect(() => {
    if (reposLoading || reposError) return;
    const anyDone = STEPS.some((s) => steps[s.key].status === 'done');
    if (anyDone && !repos.some((r) => r.id === repoId)) {
      update((prev) => ({ ...prev, repoId: null, steps: idle() }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reposLoading, reposError, repos]);

  function changePath(value) {
    // A different folder means the earlier results no longer apply.
    update(() => ({ repoPath: value, repoId: null, steps: idle() }));
  }

  async function runStep(step, knownRepoId = repoId) {
    update((prev) => ({ ...prev, steps: { ...prev.steps, [step.key]: { status: 'running', message: '' } } }));
    try {
      const res = await step.run(repoPath.trim(), knownRepoId);
      const newId = res?.repo_id ?? knownRepoId;
      await queryClient.invalidateQueries({ queryKey: ['repos'] });
      update((prev) => ({
        ...prev,
        repoId: newId,
        steps: { ...prev.steps, [step.key]: { status: 'done', message: step.summarize(res) } },
      }));

      if (step.key === 'scores') {
        queryClient.invalidateQueries({ queryKey: ['ranked'] });
        queryClient.invalidateQueries({ queryKey: ['file'] });
        // Point the Files and Backtest pages at the repository just scored.
        const fresh = await queryClient.fetchQuery({ queryKey: ['repos'], queryFn: api.repos, staleTime: 0 });
        const repo = fresh.find((r) => r.id === newId);
        if (repo) selectRepo(repo);
      }
      return { ok: true, repoId: newId };
    } catch (err) {
      update((prev) => ({
        ...prev,
        steps: { ...prev.steps, [step.key]: { status: 'error', message: friendlyError(step, err) } },
      }));
      return { ok: false, repoId: knownRepoId };
    }
  }

  async function runAll() {
    let currentId = repoId;
    for (const step of STEPS) {
      if (steps[step.key].status === 'done') continue;
      const result = await runStep(step, currentId);
      if (!result.ok) return;
      currentId = result.repoId;
    }
  }

  function lockReason(index) {
    if (!repoPath.trim() && index < 2) return 'Enter a repository path first.';
    if (index > 0 && steps[STEPS[index - 1].key].status !== 'done') {
      return `Finish “${STEPS[index - 1].title}” first.`;
    }
    return '';
  }

  const finished = STEPS.every((s) => steps[s.key].status === 'done');
  const anyDone = STEPS.some((s) => steps[s.key].status === 'done');
  const known = repoPath.trim()
    ? repos.find((r) => comparablePath(r.path) === comparablePath(repoPath))
    : null;

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Analyze a repository</h1>
        <p className="lede">
          Three steps turn a repository’s history and source code into a ranked list of files. Each
          repository you analyze is stored separately, so you can analyze several and switch between
          them on the Files page without their results mixing.
        </p>
      </div>

      <section className="before" aria-labelledby="before-title">
        <h2 id="before-title">Before you start</h2>
        <ul>
          <li>
            <strong>The API is running.</strong> The status in the top right should read “API online”.
          </li>
          <li>
            <strong>You have a local clone with full history.</strong> A shallow clone made with{' '}
            <code>--depth</code> can’t be read.
          </li>
          <li>
            <strong>Python gives the richest results.</strong> Smells are only detected in <code>.py</code>{' '}
            files. Churn and bug-fix history count for every file type.
          </li>
        </ul>
      </section>

      <div className="field">
        <label htmlFor="repo-path">Repository path</label>
        <input
          id="repo-path"
          type="text"
          value={repoPath}
          onChange={(e) => changePath(e.target.value)}
          placeholder="D:\Projects\my-repo  or  /home/me/my-repo"
          spellCheck="false"
          autoComplete="off"
          disabled={busy}
        />
        <p className="hint">
          The full path to the folder on the machine running the API. Pasting it with quotes is fine.
        </p>
      </div>

      {known && !anyDone && (
        <p className="notice" role="status">
          <strong>{known.name}</strong> has already been analyzed
          {known.last_scored_at ? ` and was last scored ${formatDate(known.last_scored_at)}` : ''}.
          Running the steps again refreshes its results.{' '}
          {known.last_scored_at && (
            <Link to="/files" onClick={() => selectRepo(known)}>View its ranked files</Link>
          )}
        </p>
      )}

      <ol className="steps">
        {STEPS.map((step, index) => {
          const s = steps[step.key];
          const locked = lockReason(index);
          return (
            <li key={step.key} className={`step step--${s.status}`}>
              <span className="step-num" aria-hidden="true">
                {s.status === 'done' ? '✓' : index + 1}
              </span>
              <div className="step-body">
                <h2>{step.title}</h2>
                <p>{step.description}</p>
                {s.status === 'running' && (
                  <p className="step-msg" role="status">Working. Large repositories can take a minute or two.</p>
                )}
                {s.status === 'done' && <p className="step-msg step-msg--ok" role="status">{s.message}</p>}
                {s.status === 'error' && <p className="step-msg step-msg--error" role="alert">{s.message}</p>}
                {locked && s.status !== 'running' && <p className="hint">{locked}</p>}
              </div>
              <button
                type="button"
                className="btn btn--secondary"
                disabled={busy || Boolean(locked)}
                onClick={() => runStep(step)}
              >
                {s.status === 'running' ? 'Working…' : s.status === 'done' ? 'Run again' : 'Run'}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="actions">
        <button type="button" className="btn" disabled={busy || finished || !repoPath.trim()} onClick={runAll}>
          {anyDone && !finished ? 'Run remaining steps' : 'Run all steps'}
        </button>
        {finished && (
          <Link className="btn btn--secondary" to="/files">
            View ranked files
          </Link>
        )}
      </div>
    </div>
  );
}
