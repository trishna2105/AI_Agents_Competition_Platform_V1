from fastapi import APIRouter, HTTPException
from backend.app.database import SessionLocal
from backend.app.models import Competition, CompetitionParticipant, Agent
from pydantic import BaseModel

router = APIRouter()


class CreateCompetitionRequest(BaseModel):
    title: str
    prompt: str
    max_iterations: int
    min_agents: int
    duration: int = 60


class JoinCompetitionRequest(BaseModel):
    agent_id: int


@router.post("/competition/create")
def create_competition(payload: CreateCompetitionRequest):
    db = SessionLocal()
    try:
        comp = Competition(
            title=payload.title,
            prompt=payload.prompt,
            max_iterations=payload.max_iterations,
            min_agents=payload.min_agents,
            duration=payload.duration
        )
        db.add(comp)
        db.commit()
        db.refresh(comp)

        return {
            "msg": "Competition created",
            "id": comp.id,
            "title": comp.title,
            "prompt": comp.prompt,
            "max_iterations": comp.max_iterations,
            "min_agents": comp.min_agents,
            "participant_count": 0,
            "status": comp.status,
            "created_at": comp.created_at,
        }
    finally:
        db.close()


@router.get("/competitions")
def get_competitions():
    db = SessionLocal()
    try:
        comps = db.query(Competition).all()
        return [
            {
                "id": c.id,
                "title": c.title,
                "prompt": c.prompt,
                "max_iterations": c.max_iterations,
                "min_agents": c.min_agents,
                "participant_count": db.query(CompetitionParticipant).filter(
                    CompetitionParticipant.competition_id == c.id
                ).count(),
                "status": c.status,
                "created_at": c.created_at,
            }
            for c in comps
        ]
    finally:
        db.close()


@router.get("/competition/{id}")
def get_competition(id: int):
    db = SessionLocal()
    try:
        c = db.query(Competition).filter(Competition.id == id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Competition not found")

        return {
            "id": c.id,
            "title": c.title,
            "prompt": c.prompt,
            "max_iterations": c.max_iterations,
            "min_agents": c.min_agents,
            "participant_count": db.query(CompetitionParticipant).filter(
                CompetitionParticipant.competition_id == c.id
            ).count(),
            "status": c.status,
            "created_at": c.created_at,
        }
    finally:
        db.close()


@router.post("/competition/{id}/join")
def join_competition(id: int, payload: JoinCompetitionRequest):
    db = SessionLocal()
    try:
        comp = db.query(Competition).filter(Competition.id == id).first()
        if not comp:
            raise HTTPException(status_code=404, detail="Competition not found")

        if comp.status == "completed":
            raise HTTPException(status_code=400, detail="competition completed")

        exists = db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id == id,
            CompetitionParticipant.agent_id == payload.agent_id
        ).first()

        if exists:
            return {"msg": "already joined"}

        count = db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id == id
        ).count()

        if count >= comp.min_agents:
            raise HTTPException(status_code=400, detail="competition full")

        agent = db.query(Agent).filter(Agent.id == payload.agent_id).first()
        if not agent:
            agent = Agent(id=payload.agent_id, name=f"Agent {payload.agent_id}")
            db.add(agent)
            db.commit()

        db.add(CompetitionParticipant(
            competition_id=id,
            agent_id=payload.agent_id
        ))
        db.commit()


        return {"msg": "joined"}
    finally:
        db.close()

@router.get("/competition/{id}/participants")
def get_participants(id: int):
    db = SessionLocal()
    try:
        comp = db.query(Competition).filter(Competition.id == id).first()
        if not comp:
            raise HTTPException(status_code=404, detail="Competition not found")

        participants = db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id == id
        ).all()

        agent_ids = [p.agent_id for p in participants]

        agents = db.query(Agent).filter(Agent.id.in_(agent_ids)).all() if agent_ids else []
        agent_map = {a.id: a for a in agents}

        return [
            {
                "agent_id": p.agent_id,
                "name": agent_map.get(p.agent_id).name if agent_map.get(p.agent_id) else f"Agent {p.agent_id}",
                "model_name": agent_map.get(p.agent_id).model_name if agent_map.get(p.agent_id) else None,
            }
            for p in participants
        ]

    finally:
        db.close()