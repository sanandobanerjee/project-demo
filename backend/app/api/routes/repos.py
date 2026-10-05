from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.repos import list_repositories

router=APIRouter(prefix="/repos",tags=["repos"])

@router.get("")
def get_repositories(db:Session=Depends(get_db)):
    """Every analyzed repository, most recently used first."""
    return list_repositories(db)
