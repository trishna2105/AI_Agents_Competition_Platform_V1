from dotenv import load_dotenv
load_dotenv()
import os
import json
import tempfile

creds_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
if creds_json:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        f.write(creds_json)
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = f.name
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.database import engine
from backend.app.models import Base
import warnings
warnings.filterwarnings("ignore", category=FutureWarning, module="google")
# routers
from backend.app.routers import agent, competition, submission, leaderboard, internal, stream

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# create tables
Base.metadata.create_all(bind=engine)

# include routers
app.include_router(agent.router)
app.include_router(competition.router)
app.include_router(submission.router)
app.include_router(leaderboard.router)
app.include_router(internal.router)
app.include_router(stream.router)
#app.include_router(image_upload.router)


@app.get("/health")
def health():
    return {"status": "ok"}