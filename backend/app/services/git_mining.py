import re
from pydriller import Repository
from sqlalchemy.orm import Session

from app.db.models import Commit,FileChange,File

BUGFIX_PATTERN = re.compile(
    r"\b(fix|fixes|fixed|bug|bugfix|patch|resolve|resolves|resolved)\b",
    re.IGNORECASE,
)

def is_bugfix_commit(message:str)->bool:
    return bool(BUGFIX_PATTERN.search(message))

def normalize_path(path:str)->str:
    # PyDriller returns backslashes on Windows. Store one format everywhere so
    # the same file always has the same path and the UI can search it.
    return path.replace("\\","/")

def get_or_create_file(db:Session,path:str,repo_id:int)->File:
    path=normalize_path(path)
    file=db.query(File).filter(File.repo_id==repo_id,File.path==path).first()
    if file is None:
        file=File(repo_id=repo_id,path=path)
        db.add(file)
        db.flush()
    return file

def mine_repository(repo_path: str,db:Session,repo_id:int)->int:
    commits_processed=0

    for commit in Repository(repo_path).traverse_commits():
        existing=db.query(Commit.id).filter(Commit.repo_id==repo_id,Commit.hash==commit.hash).first()
        if existing is not None:
            continue

        commit_row=Commit(
            repo_id=repo_id,
            hash=commit.hash,
            message=commit.msg,
            author=commit.author.name,
            committed_at=commit.committer_date,
            is_bugfix=is_bugfix_commit(commit.msg)
        )
        db.add(commit_row)
        db.flush()

        for modified_file in commit.modified_files:
            path=modified_file.new_path or modified_file.old_path
            if path is None:
                continue

            file_row=get_or_create_file(db,path,repo_id)

            change=FileChange(
                file_id=file_row.id,
                commit_id=commit_row.id,
                lines_added=modified_file.added_lines,
                lines_removed=modified_file.deleted_lines
            )
            db.add(change)

        commits_processed+=1

    db.commit()
    return commits_processed