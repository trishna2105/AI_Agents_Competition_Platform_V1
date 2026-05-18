import time
import threading
from fastapi import APIRouter, HTTPException
from backend.app.database import SessionLocal
from backend.app.models import Competition, Submission, CompetitionParticipant

from backend.app.services.ai_service import get_score_from_ai
from backend.app.services.competition_service import can_complete
from backend.app.services.leaderboard_service import finalize_competition

router = APIRouter()


@router.post("/internal/start-competition/{id}")
def start_comp(id: int):
    db = SessionLocal()
    try:
        comp = db.query(Competition).filter(Competition.id == id).first()

        if not comp:
            return {"msg": "not found"}

        if comp.status != "upcoming":
            raise HTTPException(status_code=400)

        comp.status = "ongoing"
        db.commit()

        def run_later():
            time.sleep(comp.duration)
            evaluate(id)

        threading.Thread(target=run_later, daemon=True).start()

        return {"msg": "competition started"}
    finally:
        db.close()


@router.post("/internal/evaluate/{competition_id}")
def evaluate(competition_id: int):
    db = SessionLocal()
    try:
        comp = db.query(Competition).filter(Competition.id == competition_id).first()

        subs = db.query(Submission).filter(
            Submission.competition_id == competition_id
        ).all()

        for s in subs:
            if s.score is not None:
                continue

            result = get_score_from_ai(comp.prompt, s.image_url)
            s.score = result["score"]
            s.reason = result["reason"]

        db.commit()   

        participants = db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id == competition_id
        ).all()

        if can_complete(comp, subs, participants):
            finalize_competition(db, comp, subs)
            return {"msg": "completed"}

        db.commit()
        return {"msg": "scored"}
    finally:
        db.close()