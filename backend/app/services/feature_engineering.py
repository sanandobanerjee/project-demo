from datetime import datetime, timezone

from sqlalchemy.orm import Session
from app.db.models import File


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def compute_churn(file: File, as_of:datetime | None = None)->float:
    changes=file.changes
    if as_of is not None:
        as_of_utc = _normalize_datetime(as_of)
        changes=[c for c in changes if _normalize_datetime(c.commit.committed_at) <= as_of_utc]
    return sum(change.lines_added + change.lines_removed for change in changes)

def compute_bugfix_ratio(file:File,as_of:datetime|None=None)->float:
    changes=file.changes
    if as_of is not None:
        as_of_utc = _normalize_datetime(as_of)
        changes=[c for c in changes if _normalize_datetime(c.commit.committed_at) <= as_of_utc]

    total_commits=len(changes)
    if total_commits==0:
        return 0.0

    bugfix_commits=sum(1 for change in changes if change.commit.is_bugfix)
    return bugfix_commits/total_commits

def compute_smell_density(file:File)->float:
    return float(len(file.smells))

def compute_features(file:File, as_of:datetime|None=None)->dict:
    return{
        "file_id":file.id,
        "path":file.path,
        "churn":compute_churn(file, as_of=as_of),
        "bugfix_ratio":compute_bugfix_ratio(file, as_of=as_of),
        "smell_density":compute_smell_density(file)
    }

def compute_all_features(db:Session, as_of:datetime|None=None, repo_id:int|None=None)->list[dict]:
    query=db.query(File)
    if repo_id is not None:
        query=query.filter(File.repo_id==repo_id)
    files=query.all()
    return [compute_features(file, as_of=as_of) for file in files]