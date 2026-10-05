from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models import Repository
from app.services.repos import latest_repository

def resolve_repo_id(db:Session,repo_id:int|None)->int|None:
    """Which repository a request is about.

    An explicit repo_id must exist. When it is omitted we use the repository
    that was worked on most recently, so existing calls keep working. Returns
    None only when nothing has been ingested yet.
    """
    if repo_id is not None:
        if db.get(Repository,repo_id) is None:
            raise HTTPException(status_code=404,detail="Repository not found")
        return repo_id
    latest=latest_repository(db)
    return latest.id if latest else None
