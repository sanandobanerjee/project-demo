import os

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import Commit,File,Repository,Score,Smell
from app.timeutil import iso_utc,utcnow

def normalize_repo_path(path:str)->str:
    # Windows "Copy as path" wraps the path in quotes, so strip them.
    cleaned=path.strip().strip('"').strip("'")
    return os.path.abspath(os.path.expanduser(cleaned))

def repo_name(path:str)->str:
    return os.path.basename(path.rstrip("/\\")) or path

def get_repository_by_path(db:Session,path:str)->Repository|None:
    return db.query(Repository).filter(Repository.path==path).first()

def get_or_create_repository(db:Session,path:str)->tuple[Repository,bool]:
    repo=get_repository_by_path(db,path)
    if repo is not None:
        return repo,False
    repo=Repository(path=path,name=repo_name(path))
    db.add(repo)
    db.flush()
    return repo,True

def touch_repository(db:Session,repo_id:int|None)->None:
    if repo_id is None:
        return
    repo=db.get(Repository,repo_id)
    if repo is not None:
        repo.updated_at=utcnow()
        db.commit()

def latest_repository(db:Session)->Repository|None:
    return db.query(Repository).order_by(Repository.updated_at.desc(),Repository.id.desc()).first()

def list_repositories(db:Session)->list[dict]:
    repos=db.query(Repository).order_by(Repository.updated_at.desc(),Repository.id.desc()).all()
    result=[]
    for repo in repos:
        file_count=db.query(func.count(File.id)).filter(File.repo_id==repo.id).scalar() or 0
        commit_count=db.query(func.count(Commit.id)).filter(Commit.repo_id==repo.id).scalar() or 0
        smell_count=(
            db.query(func.count(Smell.id))
            .join(File,Smell.file_id==File.id)
            .filter(File.repo_id==repo.id)
            .scalar()
        ) or 0
        last_scored=(
            db.query(func.max(Score.computed_at))
            .join(File,Score.file_id==File.id)
            .filter(File.repo_id==repo.id)
            .scalar()
        )
        result.append({
            "id":repo.id,
            "name":repo.name,
            "path":repo.path,
            "file_count":file_count,
            "commit_count":commit_count,
            "smell_count":smell_count,
            "last_scored_at":iso_utc(last_scored),
            "updated_at":iso_utc(repo.updated_at),
        })
    return result
