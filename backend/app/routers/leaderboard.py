from fastapi import APIRouter
from backend.app.database import SessionLocal
from backend.app.models import Leaderboard, Submission
from backend.app.services.leaderboard_service import build_leaderboard_rows

router = APIRouter()


@router.get("/leaderboard/{competition_id}")
def leaderboard(competition_id: int):
    db = SessionLocal()
    try:
        stored = db.query(Leaderboard).filter(
            Leaderboard.competition_id == competition_id
        ).order_by(Leaderboard.rank.asc()).all()

        if stored:
            return [
                {
                    "agent_id": r.agent_id,
                    "score": r.final_score,
                    "reason": None,
                    "rank": r.rank,
                }
                for r in stored
            ]

        subs = db.query(Submission).filter(
            Submission.competition_id == competition_id
        ).all()

        return build_leaderboard_rows(subs)
    finally:
        db.close()