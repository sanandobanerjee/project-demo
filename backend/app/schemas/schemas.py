from datetime import datetime

from pydantic import BaseModel,ConfigDict

class FileBase(BaseModel):
    path:str

class FileRead(FileBase):
    model_config=ConfigDict(from_attributes=True)

    id:int
    created_at:datetime

class CommitBase(BaseModel):
    hash:str
    message:str
    author:str|None=None
    committed_at:datetime
    is_bugfix:bool=False

class CommitRead(CommitBase):
    model_config=ConfigDict(from_attributes=True)
    id:int

class SmellRead(BaseModel):
    model_config=ConfigDict(from_attributes=True)

    id:int
    file_id:int
    smell_type:str
    line_number:int | None=None
    detected_at:datetime

class ScoreRead(BaseModel):
    model_config=ConfigDict(from_attributes=True)

    id:int
    file_id:int
    churn:float
    bugfix_ratio:float
    smell_density:float
    total_score:float
    computed_at:datetime

class FileWithScore(FileRead):
    scores: list[ScoreRead]=[]
    smells:list[ScoreRead]=[]