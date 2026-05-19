# mcp_agents/mcp_agent.py
# mcp_agents/mcp_agent.py

from mcp.server.fastmcp import FastMCP
import requests
import time

BASE_URL = "https://aiagentscompetitionplatformv1-production.up.railway.app"

mcp = FastMCP("AI Competition Agent")

VACATION_KEYWORDS = [
    "vacation", "trip", "mountain", "mountains", "beach", "beaches",
    "travel", "holiday", "resort", "ocean", "sea", "lake", "forest",
    "hiking", "trekking", "island", "sunset", "landscape", "nature",
    "adventure", "explore", "jungle", "waterfall", "camping", "road trip"
]


@mcp.tool()
def register_agent(name: str = "VacationAgent") -> dict:
    """Register a new agent in the backend."""
    return requests.post(
        f"{BASE_URL}/agent/register",
        params={"name": name, "model_name": "vertex"}
    ).json()


@mcp.tool()
def get_competitions() -> list:
    """Fetch all competitions."""
    return requests.get(f"{BASE_URL}/competitions").json()


@mcp.tool()
def filter_vacation_competitions(competitions: list) -> list:
    """
    Filter competitions to only return those related to vacations, trips,
    mountains, beaches, travel, or nature. Ignores all others.
    """
    matched = []
    for comp in competitions:
        title = comp.get("title", "").lower()
        prompt = comp.get("prompt", "").lower()
        combined = title + " " + prompt
        if any(keyword in combined for keyword in VACATION_KEYWORDS):
            matched.append(comp)
    return matched


@mcp.tool()
def join_competition(id: int, agent_id: int) -> dict:
    """Join a competition using competition id."""
    return requests.post(
        f"{BASE_URL}/competition/{id}/join",
        json={"agent_id": agent_id}
    ).json()


@mcp.tool()
def wait_for_competition_start(competition_id: int, poll_interval: int = 10, timeout: int = 600) -> dict:
    """
    Poll the competition status every poll_interval seconds until it becomes 'ongoing'.
    Checks immediately first, then polls. Returns when ongoing or gives up after timeout.
    """
    elapsed = 0
    while elapsed < timeout:
        resp = requests.get(f"{BASE_URL}/competition/{competition_id}").json()
        status = resp.get("status")

        if status == "ongoing":
            return {"status": "ongoing", "msg": "Competition has started. Proceed to generate and stream."}

        if status == "completed":
            return {"status": "completed", "msg": "Competition already completed. Nothing to do."}

        # Only sleep AFTER checking, so the first check is immediate
        time.sleep(poll_interval)
        elapsed += poll_interval

    return {"status": "timeout", "msg": f"Competition did not start within {timeout} seconds."}


@mcp.tool()
def stream_agent(competition_id: int, agent_id: int, prompt: str, reasoning: str = "") -> str:
    """
    Send final prompt to backend for image generation and wait for completion.
    Returns the full streaming result including image URL.
    """
    resp = requests.get(
        f"{BASE_URL}/stream-agent/{competition_id}/{agent_id}",
        params={
            "final_prompt": prompt,
            "reasoning": reasoning
        },
        stream=True,
        timeout=300
    )

    result_lines = []
    for line in resp.iter_lines():
        if line:
            decoded = line.decode("utf-8") if isinstance(line, bytes) else line
            if decoded.startswith("data: "):
                result_lines.append(decoded[6:])

    return "\n".join(result_lines) if result_lines else "No response received from backend."


@mcp.resource("agent://instructions")
def instructions() -> str:
    return """
You are an autonomous AI agent specializing in vacation and travel image generation competitions.

Steps:
1. Call register_agent to register yourself.
2. Call get_competitions to fetch all competitions.
3. Call filter_vacation_competitions with the full competitions list.
   - This returns only competitions related to vacations, trips, mountains, beaches, travel, or nature.
   - If the result is empty, stop — there are no relevant competitions for you.
4. From the filtered list, pick the ONLY competition with status 'upcoming'. Do NOT pick 'completed' ones.
5. Call join_competition to join it.
6. Call wait_for_competition_start with the competition_id.
   - This polls until the host clicks start and status becomes 'ongoing'.
   - NEVER skip this step. NEVER call stream_agent before this returns 'ongoing'.
   - If it returns 'completed' or 'timeout', stop gracefully. Do not stream.
7. Once wait_for_competition_start returns 'ongoing', craft a vivid, detailed prompt inspired by the competition theme.
8. Call stream_agent with your prompt and reasoning. Wait for it to finish.

Rules:
- NEVER join 'completed' competitions.
- NEVER call stream_agent before wait_for_competition_start returns 'ongoing'.
- NEVER skip step 6 for any reason, even if you think the competition is already ongoing.
- Always generate a rich, detailed visual prompt that captures the spirit of the vacation/travel theme.
"""


if __name__ == "__main__":
    mcp.run(transport="stdio")





'''
from mcp.server.fastmcp import FastMCP
import requests
import time

BASE_URL = "https://aiagentscompetitionplatformv1-production.up.railway.app"

mcp = FastMCP("AI Competition Agent")

VACATION_KEYWORDS = [
    "vacation", "trip", "mountain", "mountains", "beach", "beaches",
    "travel", "holiday", "resort", "ocean", "sea", "lake", "forest",
    "hiking", "trekking", "island", "sunset", "landscape", "nature",
    "adventure", "explore", "jungle", "waterfall", "camping", "road trip"
]


@mcp.tool()
def register_agent(name: str = "VacationAgent") -> dict:
    """Register a new agent in the backend."""
    return requests.post(
        f"{BASE_URL}/agent/register",
        params={"name": name, "model_name": "vertex"}
    ).json()


@mcp.tool()
def get_competitions() -> list:
    """Fetch all competitions."""
    return requests.get(f"{BASE_URL}/competitions").json()


@mcp.tool()
def filter_vacation_competitions(competitions: list) -> list:
    """
    Filter competitions to only return those related to vacations, trips,
    mountains, beaches, travel, or nature. Ignores all others.
    """
    matched = []

    for comp in competitions:
        title = comp.get("title", "").lower()
        prompt = comp.get("prompt", "").lower()
        combined = title + " " + prompt

        if any(keyword in combined for keyword in VACATION_KEYWORDS):
            matched.append(comp)

    return matched


@mcp.tool()
def join_competition(id: int, agent_id: int) -> dict:
    """Join a competition using competition id."""
    return requests.post(
        f"{BASE_URL}/competition/{id}/join",
        json={"agent_id": agent_id}
    ).json()


@mcp.tool()
def wait_for_competition_start(competition_id: int, poll_interval: int = 10, timeout: int = 600) -> dict:
    """
    Poll the competition status every poll_interval seconds until it becomes 'ongoing'.
    Returns when the competition starts or when timeout is reached.
    """
    elapsed = 0
    while elapsed < timeout:
        resp = requests.get(f"{BASE_URL}/competition/{competition_id}").json()
        status = resp.get("status")

        if status == "ongoing":
            return {"status": "ongoing", "msg": "Competition has started. Proceed to generate and stream."}

        if status == "completed":
            return {"status": "completed", "msg": "Competition already completed. Nothing to do."}

        time.sleep(poll_interval)
        elapsed += poll_interval

    return {"status": "timeout", "msg": f"Competition did not start within {timeout} seconds."}


@mcp.tool()
def stream_agent(competition_id: int, agent_id: int, prompt: str, reasoning: str = "") -> str:
    """Send final prompt to backend for image generation."""
    return requests.get(
        f"{BASE_URL}/stream-agent/{competition_id}/{agent_id}",
        params={
            "final_prompt": prompt,
            "reasoning": reasoning
        }
    ).text


@mcp.resource("agent://instructions")
def instructions() -> str:
    return """
You are an autonomous AI agent specializing in vacation and travel image generation competitions.

Steps:
1. Call register_agent to register yourself.
2. Call get_competitions to fetch all competitions.
3. Call filter_vacation_competitions with the full competitions list.
   - This returns only competitions related to vacations, trips, mountains, beaches, travel, or nature.
   - If the result is empty, stop — there are no relevant competitions for you.
4. From the filtered list, pick the best matching competition with status 'upcoming' or 'ongoing'.
5. Call join_competition to join it.
6. Call wait_for_competition_start with the competition_id.
   - This will poll until the host starts the competition.
   - Only proceed when it returns status 'ongoing'.
   - If it returns 'completed' or 'timeout', stop gracefully.
7. Once ongoing, craft a vivid, detailed FINAL_IMAGE_PROMPT inspired by the competition theme (vacation, travel, nature scenery).
8. Call stream_agent with your prompt and reasoning.

Rules:
- NEVER join competitions unrelated to vacations, travel, mountains, beaches, or nature. If filter_vacation_competitions returns empty, do nothing.
- Always wait for 'ongoing' before streaming. Never skip step 6.
- Never call stream_agent if wait_for_competition_start returns 'completed' or 'timeout'.
- Always generate a rich, detailed visual prompt that captures the spirit of the vacation/travel theme.
"""


if __name__ == "__main__":
    mcp.run(transport="stdio")
'''