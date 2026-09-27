from datetime import datetime

from sqlalchemy.orm import Session
from app.db.models import File

def compute_churn(file: File, as_of:datetime | None = None)->float:
    changes=file.changes
    if as_of is not None:
        changes=[c for c in changes if c.commit.committed_at <= as_of]
    return sum(change.lines_added + change.removed_lines for change in file.changes)

def compute_bugfix_ratio(file:File,as_of:datetime|None=None)->float:
    changes=file.changes
    if as_of is not None:
        changes=[c for c in changes if c.commit.committed_at<=as_of]

    total_commits=len(file.changes)
    if total_commits==0:
        return 0.0

    bugfix_commits=sum(1 for change in file.changes if change.commit.is_bugfix)
    return bugfix_commits/total_commits

def compute_smell_density(file:File)->float:
    return float(len(file.smells))

def compute_features(file:File)->dict:
    return{
        "file_id":file.id,
        "path":file.path,
        "churn":compute_churn(file),
        "bugfix_ratio":compute_bugfix_ratio(file),
        "smell_density":compute_smell_density(file)
    }

def compute_all_features(db:Session)->list[dict]:
    files=db.query(File).all()
    return [compute_features(file) for file in files]