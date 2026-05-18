from backend.app.models import Leaderboard


def build_leaderboard_rows(submissions):
    best = {}

    for s in submissions:
        score = s.score or 0
        if s.agent_id not in best or score > (best[s.agent_id]["score"] or 0):
            best[s.agent_id] = {
                "agent_id": s.agent_id,
                "score": s.score,
                "reason": s.reason
            }

    ranked = sorted(best.values(), key=lambda x: x["score"] or 0, reverse=True)

    return [
        {**row, "rank": i + 1}
        for i, row in enumerate(ranked)
    ]


def persist_leaderboard(db, competition_id, rows):
    db.query(Leaderboard).filter(Leaderboard.competition_id == competition_id).delete()

    for r in rows:
        db.add(Leaderboard(
            competition_id=competition_id,
            agent_id=r["agent_id"],
            final_score=r["score"],
            rank=r["rank"]
        ))


def finalize_competition(db, comp, submissions):
    rows = build_leaderboard_rows(submissions)
    persist_leaderboard(db, comp.id, rows)

    comp.status = "completed"
    db.commit()

    return rows