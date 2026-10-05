# Debt Scope: frontend

A React dashboard for the Code Smell Detector and Technical Debt Analyzer API in `../backend`.

## Run it

1. Start the backend from the project root:

   ```
   python -m uvicorn app.main:app --app-dir backend --reload --port 8000
   ```

2. In a second terminal:

   ```
   cd frontend
   npm install
   npm run dev
   ```

3. Open http://localhost:5173

If the API runs somewhere other than `http://127.0.0.1:8000`, copy `.env.example` to `.env` and change `VITE_API_URL`. The backend allows cross-origin requests, so no proxy is needed.

## Pages

| Route | What it does | API calls |
| --- | --- | --- |
| `/` | Overview: what Debt Scope does, how a score is built, the three steps | `GET /repos` |
| `/analyze` | Prerequisites and the three-step pipeline for a repository path | `POST /ingest/git`, `POST /ingest/analysis`, `POST /scores/compute?repo_id=` |
| `/files` | Ranked table for one repository, with a repository picker, search, level filter and sorting | `GET /files/ranked?repo_id=` |
| `/files/:id` | One file's score, factor breakdown and detected smells | `GET /files/{id}/breakdown`, `GET /files/ranked?repo_id=` |
| `/backtest` | Compares the combined score to smell-only and churn-only rankings for one repository | `POST /backtest/run` |

The header shows whether the API is reachable (`GET /health`, checked every 15 seconds).

## Repositories are kept separate

Every folder you analyze becomes its own repository in the API. The Files and Backtest pages show one at a time. After you score a repository it becomes the selected one, and you can switch with the picker at the top of those pages. Files with the same path in two repositories (for example `README.md`) are different files with their own scores.

## Times and paths

- The API sends timestamps in UTC with a `Z` suffix. The UI converts them to your own time zone and shows the zone, for example `GMT+5:30`. Timestamps without a suffix (from an older backend) are treated as UTC. The backtest date picker uses your local time and is converted to UTC when sent.
- File paths are shown and searched with forward slashes. Backslash paths from Windows are converted, and typing `\` in the search box works too.

## How the score bars work

The API returns raw churn, bug-fix ratio and smell count plus a total. The frontend rebuilds each factor's share of the total using the same weights as `backend/app/services/scoring.py` (churn 0.3, bug fixes 0.5, smells 0.2). **If you change those weights in the backend, update `FACTORS` in `src/lib/scoring.js` and the text on the Overview page.**

Severity levels (High 0.60 and up, Medium 0.30 and up, Low below) are a frontend choice, defined in `levelFor()` in the same file.

## Project layout

```
src/
  api.js              every backend call, one error format
  context/            RepoContext: the repository list and the selected one
  lib/scoring.js      weights, severity levels, per-factor breakdown
  lib/format.js       paths, dates, smell descriptions
  components/         Layout, RepoPicker, ScoreBar, LevelTag, StateMessage
  pages/              Landing, Analyze, Files, FileDetail, Backtest
  styles.css          design tokens and all styling
```

## Backend changes this version depends on

The frontend needs the repository-aware backend in this update:

- New `Repository` model. Files and commits belong to a repository, so two folders no longer merge.
- New `GET /repos`. `repo_id` is accepted by `/scores/compute`, `/files/ranked`, `/features` and `/backtest/run`. When omitted, the most recently used repository is used, so older calls keep working.
- `/ingest/git` and `/ingest/analysis` return `repo_id`. Running the smell scan again replaces earlier smells instead of adding to them.
- Timestamps use the time each row was created (they previously all carried the server start time) and end in `Z`.
- Stored file paths always use `/`.

## Things to know

- **Use a full clone.** Git ingestion fails on shallow clones (`git clone --depth ...`).
- **The backend rebuilds its database every time it starts** (`init_db` drops all tables). Analyzed repositories disappear after a restart, and the UI clears its saved progress when it notices.
- **`GET /features` isn't used.** The ranked list already contains the same values.
- Fonts (Schibsted Grotesk and JetBrains Mono) load from Google Fonts and fall back to system fonts offline.
