from datetime import datetime
from sqlalchemy.orm import Session

from app.db.models import Commit,FileChange
from app.services.scoring import compute_scores

def get_bugfix_files_after(db:Session,cutoff:datetime)->set[int]:
    rows=(
        db.query(FileChange.file.id)
        .join(Commit, FileChange.commit_id == Commit.id)
        .filter(Commit.committed_at > cutoff, Commit.is_bugfix.is_(True))
        .distinct()
        .all()
    )
    return {row[0] for row in rows}

def rank_by_total_score(scores:list[dict])->list[int]:
    ranked=sorted(scores,key=lambda s:s["total_score"],reverse=True)
    return [s["file_id"] for s in ranked]

def rank_by_smell_only(scores: list[dict]) -> list[int]:
    ranked = sorted(scores, key=lambda s: s["smell_density"], reverse=True)
    return [s["file_id"] for s in ranked]


def rank_by_churn_only(scores: list[dict]) -> list[int]:
    ranked = sorted(scores, key=lambda s: s["churn"], reverse=True)
    return [s["file_id"] for s in ranked]


def top_n_percent_hit_rate(ranked_file_ids: list[int], bugfix_file_ids: set[int], percent: float) -> float:
    if not ranked_file_ids or not bugfix_file_ids:
        return 0.0

    cutoff_index = max(1, int(len(ranked_file_ids) * percent))
    top_files = set(ranked_file_ids[:cutoff_index])

    hits = len(top_files & bugfix_file_ids)
    return hits / len(bugfix_file_ids)


def run_backtest(db: Session, cutoff: datetime, top_percent: float = 0.1) -> dict:
    scores = compute_scores(db, as_of=cutoff)
    bugfix_file_ids = get_bugfix_files_after(db, cutoff)

    our_ranking = rank_by_total_score(scores)
    smell_baseline = rank_by_smell_only(scores)
    churn_baseline = rank_by_churn_only(scores)

    return {
        "cutoff": cutoff.isoformat(),
        "top_percent": top_percent,
        "files_considered": len(scores),
        "bugfix_files_after_cutoff": len(bugfix_file_ids),
        "our_score_hit_rate": top_n_percent_hit_rate(our_ranking, bugfix_file_ids, top_percent),
        "smell_only_baseline_hit_rate": top_n_percent_hit_rate(smell_baseline, bugfix_file_ids, top_percent),
        "churn_only_baseline_hit_rate": top_n_percent_hit_rate(churn_baseline, bugfix_file_ids, top_percent),
    }