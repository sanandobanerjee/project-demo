from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session

from app.api.deps import resolve_repo_id
from app.db.database import get_db
from app.services.repos import touch_repository
from app.services.scoring import run_scoring

router=APIRouter(prefix="/scores",tags=["scores"])

@router.post("/compute")
def compute_scores_endpoint(repo_id:int|None=None,db:Session=Depends(get_db)):
    repo_id=resolve_repo_id(db,repo_id)
    scores=run_scoring(db,repo_id)
    touch_repository(db,repo_id)
    ranked=sorted(scores,key=lambda s:s["total_score"],reverse=True)
    return ranked
