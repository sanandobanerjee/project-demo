from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session

from app.api.deps import resolve_repo_id
from app.db.database import get_db
from app.services.feature_engineering import compute_all_features

router=APIRouter(prefix="/features",tags=["features"])

@router.get("")
def get_features(repo_id:int|None=None,db:Session=Depends(get_db)):
    return compute_all_features(db,repo_id=resolve_repo_id(db,repo_id))
