from fastapi import APIRouter
from backend.app.database import SessionLocal
from backend.app.models import Agent

router = APIRouter()


@router.post("/agent/register")
def register_agent(name: str, model_name: str = "vertex"):
    db = SessionLocal()
    try:
        agent = Agent(name=name, model_name=model_name)
        db.add(agent)
        db.commit()
        return {"msg": "agent created", "agent_id": agent.id}
    finally:
        db.close()


@router.post("/agent/login")
def login_agent(id: int):
    db = SessionLocal()
    try:
        agent = db.query(Agent).filter(Agent.id == id).first()
        return {"msg": "login success" if agent else "not found"}
    finally:
        db.close()