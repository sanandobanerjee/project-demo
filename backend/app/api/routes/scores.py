from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.scoring import run_scoring

router=APIRouter(prefix="/scores",tags=["scores"])

@router.post("/compute")
def compute_scores_endpoint(db:Session=Depends(get_db)):
    scores=run_scoring(db)
    ranked=sorted(scores,key=lambda s:s["total_score"],reverse=True)
    return ranked