import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, API_URL } from '../api.js';

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="5" width="14" height="6" rx="1.5" fill="var(--churn)" />
      <rect x="3" y="13" width="26" height="6" rx="1.5" fill="var(--bugfix)" />
      <rect x="3" y="21" width="9" height="6" rx="1.5" fill="var(--smell)" />
    </svg>
  );
}

function ApiStatus() {
  const { isSuccess, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 15_000,
    staleTime: 0,
  });
  const state = isLoading ? 'checking' : isSuccess ? 'online' : 'offline';
  const text = { checking: 'Checking API', online: 'API online', offline: 'API offline' }[state];
  return (
    <span className={`api-status api-status--${state}`} title={API_URL} role="status">
      <span className="api-dot" aria-hidden="true" />
      {text}
    </span>
  );
}

export default function Layout() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <Logo />
            Debt Scope
          </NavLink>
          <nav className="nav" aria-label="Main">
            <NavLink to="/analyze">Analyze</NavLink>
            <NavLink to="/files">Files</NavLink>
            <NavLink to="/backtest">Backtest</NavLink>
          </nav>
          <ApiStatus />
        </div>
      </header>
      <main id="main" className="page">
        <Outlet />
      </main>
    </>
  );
}
