from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.db.init_db import init_db
from app.api.routes import health,ingest,features,scores,backtest

@asynccontextmanager
async def lifespan(app:FastAPI):
    init_db()
    yield

app=FastAPI(title=settings.app_name,lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"]
)

app.include_router(health.router)
app.include_router(ingest.router)
app.include_router(features.router)
app.include_router(scores.router)
app.include_router(backtest.router)