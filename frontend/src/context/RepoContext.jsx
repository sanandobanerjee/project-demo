import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

// Every analyzed repository is stored separately by the API. This context holds
// the list and which one the Files and Backtest pages are looking at.
const STORE_KEY = 'debtscope.repo';
const RepoContext = createContext(null);

function loadSelection() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) ?? null;
  } catch {
    return null;
  }
}

export function RepoProvider({ children }) {
  const query = useQuery({ queryKey: ['repos'], queryFn: api.repos });
  const [selection, setSelection] = useState(loadSelection);

  const repos = query.data ?? [];
  // Match on id and path together. The API database is rebuilt when the backend
  // restarts, so an old id may now belong to a different folder.
  const current =
    repos.find((r) => selection && r.id === selection.id && r.path === selection.path) ??
    repos[0] ?? // the API lists the most recently used repository first
    null;

  const selectRepo = useCallback((repo) => {
    const next = { id: repo.id, path: repo.path };
    setSelection(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable, selection just won't persist */
    }
  }, []);

  const value = useMemo(
    () => ({
      repos,
      current,
      selectRepo,
      isLoading: query.isLoading,
      error: query.error,
      refetch: query.refetch,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, query.isLoading, query.error, selection, selectRepo]
  );

  return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}

export function useRepos() {
  const ctx = useContext(RepoContext);
  if (!ctx) throw new Error('useRepos must be used inside RepoProvider');
  return ctx;
}
