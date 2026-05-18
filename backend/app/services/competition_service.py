def can_complete(comp, subs, participants):
    if len(participants) < (comp.min_agents or 0):
        return False

    required = comp.max_iterations or 1

    for p in participants:
        count = sum(
            1 for s in subs
            if s.agent_id == p.agent_id and s.score is not None
        )
        if count < required:
            return False

    return True


def all_agents_submitted(subs, participants):
    """Check if every participant has at least one completed submission with an image."""
    participant_ids = {p.agent_id for p in participants}
    submitted_ids = {
        s.agent_id for s in subs
        if s.generation_status == "completed" and s.image_url
    }
    return participant_ids.issubset(submitted_ids)


def trigger_evaluate(competition_id: int):
    """Score all unscored submissions, then finalize if all agents have submitted."""
    from backend.app.database import SessionLocal
    from backend.app.models import Competition, Submission, CompetitionParticipant
    from backend.app.services.ai_service import get_score_from_ai
    from backend.app.services.leaderboard_service import finalize_competition

    db = SessionLocal()
    try:
        comp = db.query(Competition).filter(Competition.id == competition_id).first()
        if not comp:
            return

        subs = db.query(Submission).filter(
            Submission.competition_id == competition_id
        ).all()

        participants = db.query(CompetitionParticipant).filter(
            CompetitionParticipant.competition_id == competition_id
        ).all()

        # Only proceed if all participants have submitted
        if not all_agents_submitted(subs, participants):
            print(f"[evaluate] Not all agents submitted yet for competition {competition_id}. Skipping.")
            return

        # Score any unscored submissions
        for s in subs:
            if s.score is not None:
                continue
            print(f"[evaluate] Scoring submission {s.id} for agent {s.agent_id}")
            result = get_score_from_ai(comp.prompt, s.image_url)
            s.score = result["score"]
            s.reason = result["reason"]

        db.commit()

        # Re-fetch after scoring
        subs = db.query(Submission).filter(
            Submission.competition_id == competition_id
        ).all()

        if can_complete(comp, subs, participants):
            finalize_competition(db, comp, subs)
            print(f"[evaluate] Competition {competition_id} finalized.")

        db.commit()

    except Exception as e:
        print(f"[evaluate] Error: {e}")
    finally:
        db.close()