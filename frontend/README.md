# Debt Scope: frontend

A React dashboard for the Code Smell Detector and Technical Debt Analyzer API in `../backend`.

## Run it

1. Start the backend from the project root (see the main README):

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

If the API runs somewhere other than `http://127.0.0.1:8000`, copy `.env.example` to `.env` and change `VITE_API_URL`. The backend already allows cross-origin requests, so no proxy is needed.

## Pages

| Route | What it does | API calls |
| --- | --- | --- |
| `/analyze` | Runs the three-step pipeline for a repository path | `POST /ingest/git`, `POST /ingest/analysis`, `POST /scores/compute` |
| `/files` | Ranked table with search, level filter, sorting and a per-file score breakdown bar | `GET /files/ranked` |
| `/files/:id` | One file's score, factor breakdown and detected smells | `GET /files/{id}/breakdown`, `GET /files/ranked` |
| `/backtest` | Compares the combined score to smell-only and churn-only rankings | `POST /backtest/run` |

The header shows whether the API is reachable (`GET /health`, checked every 15 seconds).

## How the score bars work

The API returns raw churn, bug-fix ratio and smell count plus a total. The frontend rebuilds each factor's share of the total using the same weights as `backend/app/services/scoring.py` (churn 0.3, bug fixes 0.5, smells 0.2). **If you change those weights in the backend, update `FACTORS` in `src/lib/scoring.js` too.**

Severity levels (High 0.60 and up, Medium 0.30 and up, Low below) are a frontend choice, defined in `levelFor()` in the same file. Scores are normalized within one repository, so they compare files to each other, not to an absolute standard.

## Project layout

```
src/
  api.js            every backend call, one error format
  lib/scoring.js    weights, severity levels, per-factor breakdown
  lib/format.js     paths, dates, smell descriptions
  components/       Layout, ScoreBar, LevelTag, StateMessage
  pages/            Analyze, Files, FileDetail, Backtest
  styles.css        design tokens and all styling
```

## Things to know

- **Use a full clone.** Git ingestion fails on shallow clones (`git clone --depth ...`) because pydriller can't diff the boundary commits.
- **Run "Find code smells" once per database.** The backend doesn't clear old smells, so a second run counts them again. The UI warns about this and "Run all steps" skips steps that already succeeded.
- **`GET /features` isn't used.** The ranked list already contains the same values.
- Fonts (Schibsted Grotesk and JetBrains Mono) load from Google Fonts and fall back to system fonts when offline.
