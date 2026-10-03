from datetime import datetime,timezone

from sqlalchemy import Boolean,Float,DateTime,Column,String,ForeignKey,Integer
from sqlalchemy.orm import relationship

from app.db.database import Base

class File(Base):
    __tablename__="files"

    id=Column(Integer,primary_key=True,index=True)
    path=Column(String,unique=True,index=True,nullable=False)
    created_by=Column(DateTime,default=datetime.now(timezone.utc))

    changes=relationship("FileChange",back_populates="file")
    smells=relationship("Smell",back_populates="file")
    scores=relationship("Score",back_populates="file")

class Commit(Base):
    __tablename__="commits"

    id=Column(Integer,primary_key=True,index=True)
    hash=Column(String,unique=True,index=True,nullable=False)
    message=Column(String,nullable=False)
    author=Column(String,nullable=True)
    committed_at=Column(DateTime,nullable=False)
    is_bugfix=Column(Boolean,default=False)

    changes=relationship("FileChange",back_populates="commit")

class FileChange(Base):
    __tablename__="file_changes"

    id=Column(Integer,primary_key=True,index=True)
    file_id=Column(Integer,ForeignKey("files.id"),nullable=False)
    commit_id=Column(Integer,ForeignKey("commits.id"),nullable=False)
    lines_added=Column(Integer,default=0)
    lines_removed=Column(Integer,default=0)

    file=relationship("File",back_populates="changes")
    commit=relationship("Commit",back_populates="changes")

class Smell(Base):
    __tablename__="smells"

    id=Column(Integer,primary_key=True,index=True)
    file_id=Column(Integer,ForeignKey("files.id"),nullable=False)
    smell_type=Column(String,nullable=False)
    line_number=Column(Integer,nullable=True)
    detected_at=Column(DateTime,default=datetime.now(timezone.utc))

    file=relationship("File",back_populates="smells")

class Score(Base):
    __tablename__="scores"

    id=Column(Integer,primary_key=True,index=True)
    file_id=Column(Integer,ForeignKey("files.id"),nullable=False)
    churn=Column(Float,default=0.0)
    bugfix_ratio=Column(Float,default=0.0)
    smell_density=Column(Float,default=0.0)
    total_score=Column(Float,default=0.0)
    computed_at=Column(DateTime,default=datetime.now(timezone.utc))

    file=relationship("File",back_populates="scores")