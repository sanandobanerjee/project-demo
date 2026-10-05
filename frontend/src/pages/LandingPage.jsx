import { Link } from 'react-router-dom';
import { useRepos } from '../context/RepoContext.jsx';
import { FACTORS } from '../lib/scoring.js';

const FACTOR_TEXT = {
  churn:
    'How many lines were added and removed across the file’s history. Files that are rewritten constantly tend to be the fragile ones.',
  bugfix:
    'The share of changes to the file whose commit message mentions a fix, with words like fix, bug or patch. Files that keep needing fixes keep breaking.',
  smell:
    'Overly complex functions and low-maintainability code, found by scanning the Python source itself.',
};

const STEPS = [
  {
    title: 'Read Git history',
    text: 'Records every commit, which files it touched, how many lines changed, and whether the message describes a fix.',
  },
  {
    title: 'Find code smells',
    text: 'Scans Python files for functions with too many branches and files that are hard to maintain.',
  },
  {
    title: 'Score and rank',
    text: 'Combines the three signals into one score per file and sorts the list, worst first.',
  },
];

export default function LandingPage() {
  const { repos } = useRepos();

  return (
    <div className="stack stack--loose">
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Find the files that deserve refactoring first</h1>
        <p className="lede">
          Debt Scope reads a repository’s Git history and scans its Python code, then ranks every file
          by how much technical debt it carries. Start at the top of the list instead of guessing.
        </p>
        <div className="actions">
          <Link className="btn" to="/analyze">Analyze a repository</Link>
          {repos.length > 0 && (
            <Link className="btn btn--secondary" to="/files">View ranked files</Link>
          )}
        </div>
      </section>

      <section className="stack stack--tight" aria-labelledby="anatomy-title">
        <h2 id="anatomy-title">How a score is built</h2>
        <p className="lede">
          Every file gets a score from 0 to 1 built from three signals. Each signal is scaled against
          the other files in the same repository, so a high score means the file stands out among its
          neighbors, not that the code is bad in absolute terms.
        </p>

        <div className="anatomy" role="img" aria-label="A score is 30% churn, 50% bug fixes and 20% smells">
          {FACTORS.map((f) => (
            <span key={f.key} className="anatomy-seg" style={{ flexGrow: f.weight * 100, background: f.color }}>
              {f.label} {Math.round(f.weight * 100)}%
            </span>
          ))}
        </div>

        <ul className="anatomy-cols">
          {FACTORS.map((f) => (
            <li key={f.key}>
              <h3>
                <span className="swatch" style={{ background: f.color }} aria-hidden="true" />
                {f.label}
              </h3>
              <p className="muted">{FACTOR_TEXT[f.key]}</p>
            </li>
          ))}
        </ul>
        <p className="muted small">A file that ranks worst on all three signals scores 1.00, the full width of the bar.</p>
      </section>

      <section className="stack stack--tight" aria-labelledby="how-title">
        <h2 id="how-title">Three steps from a folder to a ranking</h2>
        <ol className="how">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="how-num" aria-hidden="true">{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p className="muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p>
          You need a local clone of a Git repository. Debt Scope keeps every repository you analyze
          separate, so you can switch between them without mixing their files.
        </p>
      </section>

      <section className="stack stack--tight" aria-labelledby="use-title">
        <h2 id="use-title">What you get</h2>
        <ul className="uses">
          <li>
            <h3><Link to="/files">Ranked files</Link></h3>
            <p className="muted">
              Every file in order, with a bar showing where its score comes from. Search by path or
              filter by level, then open a file to see why it ranks where it does.
            </p>
          </li>
          <li>
            <h3><Link to="/backtest">Backtest</Link></h3>
            <p className="muted">
              Pick a date in the past and check whether the files that were fixed afterwards were
              already near the top of the ranking, compared with simpler rankings.
            </p>
          </li>
        </ul>
      </section>
    </div>
  );
}
