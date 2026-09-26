from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.git_mining import mine_repository

router=APIRouter(prefix="/ingest",tags=["ingest"])

class GitIngestRequest(BaseModel):
    repo_path:str

@router.post("/git")
def ingest_git(payload:GitIngestRequest,db:Session=Depends(get_db)):
    try:
        commits_processed=mine_repository(payload.repo_path,db)
    except Exception as exc:
        raise HTTPException(status_code=400,detail=str(exc))

    return {"commits_processed":commits_processed}