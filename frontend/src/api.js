// All backend calls live here. Components never call fetch directly.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function readDetail(detail) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join('; ');
  return null;
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new ApiError(`Can't reach the API at ${API_URL}. Start the backend and try again.`, 0);
  }

  if (!res.ok) {
    let message = `The API returned an error (${res.status}).`;
    try {
      const body = await res.json();
      message = readDetail(body.detail) ?? message;
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(message, res.status);
  }
  return res.json();
}

const post = (path, body) =>
  request(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  health: () => request('/health'),
  ingestGit: (repoPath) => post('/ingest/git', { repo_path: repoPath }),
  ingestAnalysis: (repoPath) => post('/ingest/analysis', { repo_path: repoPath }),
  computeScores: () => post('/scores/compute'),
  rankedFiles: () => request('/files/ranked'),
  fileBreakdown: (id) => request(`/files/${id}/breakdown`),
  runBacktest: ({ cutoff, topPercent }) =>
    post('/backtest/run', { cutoff, top_percent: topPercent }),
};
