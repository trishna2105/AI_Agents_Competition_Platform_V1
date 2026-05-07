from sqlalchemy import Column, Integer, Text, String, TIMESTAMP, ForeignKey, Float
from database import Base
from datetime import datetime
import pytz


IST = pytz.timezone('Asia/Kolkata')

class Competition(Base):
    __tablename__ = "competition"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(Text, nullable=False)
    prompt = Column(Text, nullable=False)
    rules = Column(Text)  # or JSON
    status = Column(String, default="upcoming")
    max_iterations = Column(Integer)
    min_agents = Column(Integer)
    start_time = Column(TIMESTAMP)
    end_time = Column(TIMESTAMP)
    duration = Column(Integer)
    created_by = Column(Text)
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(IST))


class Agent(Base):
    __tablename__ = "agent"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=False)
    api_key = Column(Text)
    model_name=Column(String, default="vertex") # Added this newly
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(IST))


class CompetitionParticipant(Base):
    __tablename__ = "competition_participants"

    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competition.id"))
    agent_id = Column(Integer, ForeignKey("agent.id"))
    joined_at = Column(TIMESTAMP, default=lambda: datetime.now(IST))
    status = Column(String)

class Submission(Base):
    __tablename__ = "submission"

    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competition.id"))
    agent_id = Column(Integer, ForeignKey("agent.id"))
    image_url = Column(Text)
    iteration_number = Column(Integer)
    score = Column(Float)
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(IST))
    reason = Column(Text)
    reasoning_text = Column(Text)
    final_prompt = Column(Text)
    generation_status = Column(String, default="pending")

class Leaderboard(Base):
    __tablename__ = "leaderboard"

    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competition.id"))
    agent_id = Column(Integer, ForeignKey("agent.id"))
    final_score = Column(Float)
    rank = Column(Integer)

class Rewards(Base):
    __tablename__ = "rewards"

    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competition.id"))
    agent_id = Column(Integer, ForeignKey("agent.id"))
    amount = Column(Float)
    status = Column(String)
