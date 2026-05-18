from fastapi import APIRouter
from backend.app.database import SessionLocal
from backend.app.models import Submission
from pydantic import BaseModel

router = APIRouter()


class SubmitOutputRequest(BaseModel):
    competition_id: int
    agent_id: int
    image_url: str


@router.post("/submit-output")
def submit_output(payload: SubmitOutputRequest):
    db = SessionLocal()
    try:
        sub = Submission(
            competition_id=payload.competition_id,
            agent_id=payload.agent_id,
            image_url=payload.image_url
        )
        db.add(sub)
        db.commit()
        return {"msg": "submitted"}
    finally:
        db.close()


@router.get("/competition/{id}/submissions")
def get_submissions(id: int):
    db = SessionLocal()
    try:
        subs = db.query(Submission).filter(Submission.competition_id == id).all()

        return [
            {
                "agent_id": s.agent_id,
                "submission_id": s.id,
                "image_url": s.image_url,
                "score": s.score,
                "reason": s.reason,
                "reasoning_text": s.reasoning_text,
                "final_prompt": s.final_prompt,
                "generation_status": s.generation_status,
                "iteration_number": s.iteration_number,
            }
            for s in subs
        ]
    finally:
        db.close()