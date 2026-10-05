from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.db.models import Commit, File, FileChange, Repository, Smell
from app.services.feature_engineering import compute_all_features, compute_churn
from app.services.scoring import compute_scores


def build_db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


def add_repo(db, path="/tmp/demo"):
    repo = Repository(path=path, name=path.rsplit("/", 1)[-1])
    db.add(repo)
    db.commit()
    return repo


def test_compute_churn_and_scores_work_for_file_changes():
    db = build_db()
    try:
        repo = add_repo(db)
        file = File(repo_id=repo.id, path="demo.py")
        db.add(file)
        db.commit()

        commit = Commit(
            repo_id=repo.id,
            hash="abc123",
            message="fix bug in parser",
            author="dev",
            committed_at=datetime.now(timezone.utc),
            is_bugfix=True,
        )
        db.add(commit)
        db.commit()

        change = FileChange(
            file_id=file.id,
            commit_id=commit.id,
            lines_added=10,
            lines_removed=2,
        )
        db.add(change)
        db.commit()

        reloaded_file = db.query(File).filter(File.id == file.id).one()

        assert compute_churn(reloaded_file) == 12

        features = compute_all_features(db)
        assert features[0]["churn"] == 12
        assert features[0]["bugfix_ratio"] == 1.0

        scores = compute_scores(db)
        assert scores
        assert scores[0]["file_id"] == reloaded_file.id
        assert isinstance(scores[0]["total_score"], float)
    finally:
        db.close()


def test_maintainability_smell_allows_null_line_number_and_aware_cutoff():
    db = build_db()
    try:
        repo = add_repo(db)
        file = File(repo_id=repo.id, path="demo.py")
        db.add(file)
        db.commit()

        smell = Smell(file_id=file.id, smell_type="low_maintainability_index", line_number=None)
        db.add(smell)
        db.commit()

        assert db.query(Smell).filter(Smell.file_id == file.id).count() == 1

        cutoff = datetime(2026, 1, 1, tzinfo=timezone.utc)
        scores = compute_scores(db, as_of=cutoff)
        assert len(scores) == 1
        assert scores[0]["file_id"] == file.id
        assert isinstance(scores[0]["total_score"], float)
    finally:
        db.close()
