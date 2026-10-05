from sqlalchemy.orm import Session

from app.db.models import File,Score
from app.timeutil import iso_utc

def get_latest_scores(db:Session,repo_id:int|None=None)->list[dict]:
    query=db.query(Score).join(File,Score.file_id==File.id)
    if repo_id is not None:
        query=query.filter(File.repo_id==repo_id)

    # Newest first per file. The id breaks ties so the most recent run always wins.
    all_scores=query.order_by(Score.file_id,Score.computed_at.desc(),Score.id.desc()).all()

    latest_by_file={}
    for score in all_scores:
        if score.file_id not in latest_by_file:
            latest_by_file[score.file_id]=score

    ranked=sorted(latest_by_file.values(), key=lambda s: s.total_score,reverse=True)

    return[
        {
            "file_id":s.file_id,
            "path": s.file.path,
            "churn": s.churn,
            "bugfix_ratio": s.bugfix_ratio,
            "smell_density": s.smell_density,
            "total_score": s.total_score,
            "computed_at": iso_utc(s.computed_at)
        }
        for s in ranked
    ]

def get_file_breakdown(db:Session,file_id:int)->dict|None:
    file=db.query(File).filter(File.id==file_id).first()
    if file is None:
        return None

    latest_score=(
        db.query(Score)
        .filter(Score.file_id==file_id)
        .order_by(Score.computed_at.desc(),Score.id.desc())
        .first()
    )

    return {
        "file_id": file.id,
        "repo_id": file.repo_id,
        "path": file.path,
        "score": {
            "churn": latest_score.churn,
            "bugfix_ratio": latest_score.bugfix_ratio,
            "smell_density": latest_score.smell_density,
            "total_score": latest_score.total_score,
            "computed_at": iso_utc(latest_score.computed_at)
    } if latest_score else None,
    "smells": [
            {
                "smell_type": smell.smell_type,
                "line_number": smell.line_number,
            }
            for smell in file.smells
        ],
    }
