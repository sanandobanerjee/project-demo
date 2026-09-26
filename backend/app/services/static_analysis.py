import os

from radon.complexity import cc_visit
from radon.metrics import mi_visit
from sqlalchemy.orm import Session

from app.db.models import File,Smell

COMPLEXITY_THRESHOLD=10
MAINTAINABILITY_THRESHOLD=65.0

def analyze_file(source:str)->list[dict]:
    smells=[]

    for block in cc_visit(source):
        if block.complexity>COMPLEXITY_THRESHOLD:
            smells.append({
                "smell_type":"high_cyclomatic_complexity",
                "line_number":block.lineno
            })

    mi_score=mi_visit(source,multi=True)
    if mi_score is not None and mi_score<MAINTAINABILITY_THRESHOLD:
        smells.append({
            "smell_type":"low_maintainability_index",
            "line_number":None
        })

    return smells

def analyze_repository(repo_path:str,db:Session)->int:
    smells_created=0

    for root, _, filenames in os.walk(repo_path):
        if ".git" in root:
            continue

        for filename in filenames:
            if not filename.endswith(".py"):
                continue

        full_path=os.path.join(root,filename)
        relative_path=os.path.relpath(full_path,repo_path)

        try:
            with open(full_path,"r",encoding="utf-8",errors="ignore") as f:
                source=f.read()
        except OSError:
            continue

        file_row=db.query(File).filter(File.path==relative_path).first()
        if file_row is None:
            continue

        for smell_data in analyze_file(source):
            smell=Smell(
                file_id=file_row.id,
                smell_type=smell_data["smell_type"],
                line_number=smell_data["line_number"]
            )
            db.add(smell)
            smells_created+=1

    db.commit()
    return smells_created