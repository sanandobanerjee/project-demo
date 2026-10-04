import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';

const STORE_KEY = 'debtscope.pipeline';

const STEPS = [
  {
    key: 'git',
    title: 'Read Git history',
    description: 'Collects every commit and the files each one changed.',
    run: (path) => api.ingestGit(path),
    summarize: (res) =>
      res.commits_processed === 0
        ? 'No new commits. This history was already loaded.'
        : `${res.commits_processed.toLocaleString()} new commits read.`,
  },
  {
    key: 'analysis',
    title: 'Find code smells',
    description: 'Scans Python files for overly complex or hard-to-maintain code.',
    run: (path) => api.ingestAnalysis(path),
    summarize: (res) => `${res.smells_created.toLocaleString()} smells found.`,
  },
  {
    key: 'scores',
    title: 'Score files',
    description: 'Combines churn, bug-fix history and smells into one score per file.',
    run: () => api.computeScores(),
    summarize: (res) => `${res.length.toLocaleString()} files scored.`,
  },
];

const idle = () => Object.fromEntries(STEPS.map((s) => [s.key, { status: 'idle', message: '' }]));

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!saved) return { repoPath: '', steps: idle() };
    const steps = idle();
    for (const s of STEPS) {
      const item = saved.steps?.[s.key];
      if (item && (item.status === 'done' || item.status === 'error')) steps[s.key] = item;
    }
    return { repoPath: saved.repoPath ?? '', steps };
  } catch {
    return { repoPath: '', steps: idle() };
  }
}

export default function AnalyzePage() {
  const queryClient = useQueryClient();
  const [state, setState] = useState(loadSaved);
  const { repoPath, steps } = state;
  const busy = STEPS.some((s) => steps[s.key].status === 'running');

  function commit(next) {
    setState(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable, the page still works */
    }
  }

  function changePath(value) {
    // A different repository means the earlier results no longer apply.
    commit({ repoPath: value, steps: idle() });
  }

  function patchStep(key, patch) {
    setState((prev) => {
      const next = { ...prev, steps: { ...prev.steps, [key]: { ...prev.steps[key], ...patch } } };
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function runStep(step) {
    patchStep(step.key, { status: 'running', message: '' });
    try {
      const res = await step.run(repoPath.trim());
      patchStep(step.key, { status: 'done', message: step.summarize(res) });
      if (step.key === 'scores') queryClient.invalidateQueries({ queryKey: ['ranked'] });
      return true;
    } catch (err) {
      const friendly =
        err.status === 400 && step.key !== 'scores'
          ? `Couldn't read that repository. Check that the path exists on the API's machine, contains a .git folder, and is a full clone rather than a shallow one.\n\nDetails: ${err.message}`
          : err.message;
      patchStep(step.key, { status: 'error', message: friendly });
      return false;
    }
  }

  async function runAll() {
    for (const step of STEPS) {
      if (steps[step.key].status === 'done') continue;
      const ok = await runStep(step);
      if (!ok) return;
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

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Analyze a repository</h1>
        <p className="lede">
          Point Debt Scope at a local Git repository. Three steps turn its history and source code
          into a ranked list of files that deserve attention.
        </p>
      </div>

      <div className="field">
        <label htmlFor="repo-path">Repository path</label>
        <input
          id="repo-path"
          type="text"
          value={repoPath}
          onChange={(e) => changePath(e.target.value)}
          placeholder="D:\Projects\requests-test  or  /home/me/requests-test"
          spellCheck="false"
          autoComplete="off"
          disabled={busy}
        />
        <p className="hint">
          The full path on the machine running the API. The folder must contain a <code>.git</code>{' '}
          directory.
        </p>
      </div>

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
                {s.status === 'running' && <p className="step-msg" role="status">Working. Large repositories can take a minute.</p>}
                {s.status === 'done' && <p className="step-msg step-msg--ok" role="status">{s.message}</p>}
                {s.status === 'error' && <p className="step-msg step-msg--error" role="alert">{s.message}</p>}
                {s.status === 'done' && step.key === 'analysis' && (
                  <p className="hint">Running this step again counts the same smells twice.</p>
                )}
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
          {STEPS.some((s) => steps[s.key].status === 'done') && !finished ? 'Run remaining steps' : 'Run all steps'}
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
