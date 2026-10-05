import os

from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.git_mining import mine_repository
from app.services.repos import (
    get_or_create_repository,
    get_repository_by_path,
    normalize_repo_path,
    touch_repository,
)
from app.services.static_analysis import analyze_repository

router=APIRouter(prefix="/ingest",tags=["ingest"])

class GitIngestRequest(BaseModel):
    repo_path:str

@router.post("/git")
def ingest_git(payload:GitIngestRequest,db:Session=Depends(get_db)):
    path=normalize_repo_path(payload.repo_path)
    if not os.path.isdir(path):
        raise HTTPException(status_code=400,detail=f"Folder not found: {path}")

    repo,_=get_or_create_repository(db,path)
    try:
        commits_processed=mine_repository(path,db,repo.id)
    except Exception as exc:
        # Also discards a repository row created for this request.
        db.rollback()
        raise HTTPException(status_code=400,detail=str(exc))

    touch_repository(db,repo.id)
    return {"repo_id":repo.id,"commits_processed":commits_processed}

class AnalysisIngestRequest(BaseModel):
    repo_path:str

@router.post("/analysis")
def ingest_analysis(payload:AnalysisIngestRequest,db: Session=Depends(get_db)):
    path=normalize_repo_path(payload.repo_path)
    repo=get_repository_by_path(db,path)
    if repo is None:
        raise HTTPException(
            status_code=400,
            detail="This repository hasn't been read yet. Run the Git history step first.",
        )

    try:
        smells_created=analyze_repository(repo.path,db,repo.id)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400,detail=str(exc))

    touch_repository(db,repo.id)
    return {"repo_id":repo.id,"smells_created":smells_created}
