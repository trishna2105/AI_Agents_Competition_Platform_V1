from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from backend.app.database import SessionLocal
from backend.app.models import Competition, Agent, Submission

from backend.app.services.stream_service import call_gemini_stream
from backend.app.services.image_service import generate_image
from backend.app.utils.helpers import sse, split_generation_text
from backend.app.services.competition_service import trigger_evaluate  # ← NEW

router = APIRouter()


@router.get("/stream-agent/{competition_id}/{agent_id}")
def stream_agent(
    competition_id: int,
    agent_id: int,
    final_prompt: str = Query(default=None),
    reasoning: str = Query(default=None)
):
    db = SessionLocal()

    try:
        comp = db.query(Competition).filter(Competition.id == competition_id).first()
        agent = db.query(Agent).filter(Agent.id == agent_id).first()

        if not comp or not agent:
            raise HTTPException(status_code=404)

        if comp.status != "ongoing":
            return StreamingResponse(
                iter([sse("Competition not active")]),
                media_type="text/event-stream"
            )

        existing = db.query(Submission).filter(
            Submission.competition_id == competition_id,
            Submission.agent_id == agent_id
        ).first()

        if existing and existing.generation_status == "completed":
            def events_existing():
                if existing.reasoning_text:
                    yield sse(existing.reasoning_text)
                if existing.image_url:
                    yield sse(f"IMAGE_READY:{existing.image_url}")

            return StreamingResponse(events_existing(), media_type="text/event-stream")

        if not existing:
            sub = Submission(
                competition_id=competition_id,
                agent_id=agent_id,
                iteration_number=1,
                generation_status="streaming"
            )
            db.add(sub)
            db.commit()
            db.refresh(sub)
        else:
            sub = existing

        submission_id = sub.id
        model_name = agent.model_name
        comp_prompt = comp.prompt

    finally:
        db.close()

    def events():
        db = SessionLocal()
        full_text = ""

        try:
            # ==========================================
            # CASE 1: Agent sends FINAL PROMPT directly
            # ==========================================
            if final_prompt:
                image_prompt = final_prompt

                sub = db.query(Submission).filter(Submission.id == submission_id).first()
                sub.reasoning_text = reasoning or "No reasoning provided"
                sub.final_prompt = image_prompt
                db.commit()

                yield sse("Using agent-generated prompt")

                image_url = generate_image(model_name, image_prompt)

                sub = db.query(Submission).filter(Submission.id == submission_id).first()
                sub.image_url = image_url
                sub.generation_status = "completed"
                db.commit()

                yield sse(f"IMAGE_READY:{image_url}")

                # ← NEW: trigger scoring after this agent submits
                try:
                    trigger_evaluate(competition_id)
                except Exception as e:
                    print(f"[stream] trigger_evaluate error: {e}")

                return

            # ==========================================
            # CASE 2: Backend generates via Gemini
            # ==========================================
            prompt = f"""
Competition prompt: {comp_prompt}

Generate reasoning and then FINAL_IMAGE_PROMPT.
"""

            for chunk in call_gemini_stream(prompt):
                full_text += chunk

                sub = db.query(Submission).filter(Submission.id == submission_id).first()
                sub.reasoning_text = full_text

                if len(full_text) % 100 == 0:
                    db.commit()

                yield sse(chunk)

            _, final_prompt_extracted = split_generation_text(full_text)
            image_prompt = final_prompt_extracted or comp_prompt

            image_url = generate_image(model_name, image_prompt)

            sub = db.query(Submission).filter(Submission.id == submission_id).first()
            sub.reasoning_text = full_text
            sub.final_prompt = image_prompt
            sub.image_url = image_url
            sub.generation_status = "completed"
            db.commit()

            yield sse(f"IMAGE_READY:{image_url}")

            # ← NEW: trigger scoring after this agent submits
            try:
                trigger_evaluate(competition_id)
            except Exception as e:
                print(f"[stream] trigger_evaluate error: {e}")

        except Exception as e:
            yield sse(f"ERROR: {e}")

        finally:
            db.close()

    return StreamingResponse(events(), media_type="text/event-stream")