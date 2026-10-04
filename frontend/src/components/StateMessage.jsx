// One component for loading, empty and error states so they all read the same.
export default function StateMessage({ title, children, action, tone = 'neutral' }) {
  return (
    <div className={`state state--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <p className="state-title">{title}</p>
      {children && <p className="state-body">{children}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}
