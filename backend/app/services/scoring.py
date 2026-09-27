from sqlalchemy.orm import Session

from app.db.models import Score
from app.services.feature_engineering import compute_all_features

CHURN_WEIGHT=0.3
BUGFIX_WEIGHT=0.5
SMELL_WEIGHT=0.2

def normalize(values: list[float])->list[float]:
    if not values:
        return []

    min_val=min(values)
    max_val=max(values)

    if max_val==min_val:
        return [0.0 for _ in values]

    return [(v-min_val)/(max_val-min_val) for v in values]

def compute_scores(db:Session)->list[dict]:
    features=compute_all_features(db)

    churn_values=[f["churn"] for f in features]
    smell_values=[f["smell_density"] for f in features]

    normalized_churn=normalize(churn_values)
    normalized_smells=normalize(smell_values)

    results=[]
    for feature,norm_churn,norm_smell in zip(features,normalized_churn,normalized_smells):
        total_score=(
            CHURN_WEIGHT*norm_churn + BUGFIX_WEIGHT*feature["bufix_ratio"+SMELL_WEIGHT]*norm_smell)

        results.append({
            "file.id":feature["file_id"],
            "path": feature["path"],
            "churn": feature["churn"],
            "bugfix_ratio": feature["bugfix_ratio"],
            "smell_density": feature["smell_density"],
            "total_score": total_score
        })

    return results

def persist_scores(db:Session,scores:list[dict])->int:
    for score_data in scores:
        score_row=Score(
            file_id=score_data["file_id"],
            churn=score_data["churn"],
            bugfix_ratio=score_data["bugfix_ratio"],
            smell_density=score_data["smell_density"],
            total_score=score_data["total_score"]
        )
        db.add(score_row)

    db.commit()
    return len(scores)

def run_scoring(db:Session)->list[dict]:
    scores=compute_scores(db)
    persist_scores(db,scores)
    return scores