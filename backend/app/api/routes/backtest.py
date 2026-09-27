from datetime import datetime

from fastapi import APIRouter,Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.backtesting import run_backtest

router=APIRouter(prefix="/backtest",tags=["backtest"])

class BacktestRequest(BaseModel):
    cutoff: datetime
    top_percent:float=0.1

@router.post("/run")
def run_backtest_endpoint(payload:BacktestRequest,db:Session=Depends(get_db)):
    return run_backtest(db,payload.cutoff,payload.top_percent)