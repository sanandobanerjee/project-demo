"""Regression tests: analyzing a second repository must not leak into the first."""
import os
import textwrap
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.db.models import Commit, File, FileChange, Repository, Score, Smell
from app.services.git_mining import normalize_path
from app.services.ranking import get_file_breakdown, get_latest_scores
from app.services.repos import list_repositories, normalize_repo_path
from app.services.scoring import run_scoring
from app.services.static_analysis import analyze_repository
from app.timeutil import iso_utc


def build_db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def add_repo_with_file(db, repo_path, file_path, lines, bugfix=False):
    repo = Repository(path=repo_path, name=os.path.basename(repo_path))
    db.add(repo)
    db.flush()
    file = File(repo_id=repo.id, path=file_path)
    db.add(file)
    db.flush()
    commit = Commit(
        repo_id=repo.id,
        hash="same-hash",  # identical hash in both repos must be allowed
        message="fix bug" if bugfix else "add feature",
        committed_at=datetime(2026, 1, 1),
        is_bugfix=bugfix,
    )
    db.add(commit)
    db.flush()
    db.add(FileChange(file_id=file.id, commit_id=commit.id, lines_added=lines, lines_removed=0))
    db.commit()
    return repo, file


def test_same_relative_path_in_two_repos_stays_separate():
    db = build_db()
    try:
        repo_a, file_a = add_repo_with_file(db, "/work/a", "app/main.py", lines=10)
        repo_b, file_b = add_repo_with_file(db, "/work/b", "app/main.py", lines=500, bugfix=True)

        assert file_a.id != file_b.id

        run_scoring(db, repo_a.id)
        run_scoring(db, repo_b.id)

        ranked_a = get_latest_scores(db, repo_a.id)
        ranked_b = get_latest_scores(db, repo_b.id)

        assert [r["file_id"] for r in ranked_a] == [file_a.id]
        assert [r["file_id"] for r in ranked_b] == [file_b.id]
        assert ranked_a[0]["churn"] == 10
        assert ranked_b[0]["churn"] == 500
    finally:
        db.close()


def test_scores_are_normalized_within_one_repository():
    db = build_db()
    try:
        repo_a, _ = add_repo_with_file(db, "/work/a", "one.py", lines=10)
        add_repo_with_file(db, "/work/b", "two.py", lines=9999)

        scores = run_scoring(db, repo_a.id)
        assert len(scores) == 1  # only repo A's file takes part
    finally:
        db.close()


def test_latest_score_wins_after_rescoring():
    db = build_db()
    try:
        repo, file = add_repo_with_file(db, "/work/a", "m.py", lines=10)
        run_scoring(db, repo.id)

        # More history arrives, then the repository is scored again.
        commit = Commit(repo_id=repo.id, hash="second", message="add", committed_at=datetime(2026, 2, 1))
        db.add(commit)
        db.flush()
        db.add(FileChange(file_id=file.id, commit_id=commit.id, lines_added=90, lines_removed=0))
        db.commit()
        run_scoring(db, repo.id)

        ranked = get_latest_scores(db, repo.id)
        assert len(ranked) == 1
        assert ranked[0]["churn"] == 100  # the newer run, not the stale first one
        assert db.query(Score).filter(Score.file_id == file.id).count() == 2
    finally:
        db.close()


def test_timestamps_are_per_row_and_marked_utc():
    db = build_db()
    try:
        repo, file = add_repo_with_file(db, "/work/a", "m.py", lines=1)
        run_scoring(db, repo.id)
        run_scoring(db, repo.id)
        first, second = db.query(Score).order_by(Score.id).all()
        assert second.computed_at >= first.computed_at

        stamp = get_latest_scores(db, repo.id)[0]["computed_at"]
        assert stamp.endswith("Z")
        assert get_file_breakdown(db, file.id)["score"]["computed_at"].endswith("Z")
        assert iso_utc(datetime(2026, 1, 1, 12, 0)) == "2026-01-01T12:00:00Z"
        assert iso_utc(datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)) == "2026-01-01T12:00:00Z"
    finally:
        db.close()


def test_breakdown_reports_its_repository():
    db = build_db()
    try:
        repo, file = add_repo_with_file(db, "/work/a", "m.py", lines=1)
        assert get_file_breakdown(db, file.id)["repo_id"] == repo.id
    finally:
        db.close()


def test_running_the_smell_scan_twice_does_not_double_count(tmp_path):
    branches = "\n".join(f"    if x == {i}:\n        return {i}" for i in range(15))
    (tmp_path / "tangled.py").write_text(f"def f(x):\n{branches}\n    return -1\n")

    db = build_db()
    try:
        repo = Repository(path=str(tmp_path), name="tmp")
        db.add(repo)
        db.flush()
        file = File(repo_id=repo.id, path="tangled.py")
        db.add(file)
        db.commit()

        first = analyze_repository(str(tmp_path), db, repo.id)
        second = analyze_repository(str(tmp_path), db, repo.id)

        assert first == second > 0
        assert db.query(Smell).filter(Smell.file_id == file.id).count() == first
    finally:
        db.close()


def test_list_repositories_reports_counts_and_scoring():
    db = build_db()
    try:
        repo, _ = add_repo_with_file(db, "/work/a", "m.py", lines=1)
        assert list_repositories(db)[0]["last_scored_at"] is None
        run_scoring(db, repo.id)
        info = list_repositories(db)[0]
        assert info["file_count"] == 1 and info["commit_count"] == 1
        assert info["last_scored_at"].endswith("Z")
    finally:
        db.close()


def test_normalize_repo_path_strips_quotes_and_whitespace(tmp_path):
    assert normalize_repo_path(f'  "{tmp_path}"  ') == str(tmp_path)


def test_windows_style_paths_are_stored_with_forward_slashes():
    # PyDriller returns backslashes on Windows. The API should always use "/".
    assert normalize_path("app\\api\\mailer.py") == "app/api/mailer.py"
    assert normalize_path("app/api/mailer.py") == "app/api/mailer.py"
