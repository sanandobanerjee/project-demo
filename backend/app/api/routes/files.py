from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.ranking import get_file_breakdown,get_latest_scores

router=APIRouter(prefix="/files",tags=["files"])

@router.get("/ranked")
def ranked_files(db:Session=Depends(get_db)):
    return get_latest_scores(db)

@router.get("/{file_id}/breakdown")
def file_breakdown(file_id:int,db:Session=Depends(get_db)):
    result=get_file_breakdown(db,file_id)
    if result is None:
        raise HTTPException(status_code=404,detail="File Not Found")
    return result