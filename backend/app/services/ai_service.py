import vertexai
from vertexai.generative_models import GenerativeModel, Part
from backend.app.utils.config import VERTEX_PROJECT, VERTEX_LOCATION


def init_vertex():
    vertexai.init(project=VERTEX_PROJECT, location=VERTEX_LOCATION)


def get_score_from_ai(prompt, image_url):
    try:
        init_vertex()

        model = GenerativeModel("gemini-2.5-flash")

        response = model.generate_content([
            "Rate this image from 1 to 10.\n"
            "Give a SHORT reason in 2–3 lines only.\n"
            "Return format: score: <number>, reason: <text>",
            Part.from_uri(image_url, mime_type="image/png")
        ])

        text = response.text

        score = float(text.split("score:")[1].split(",")[0].strip())
        reason = text.split("reason:", 1)[1].strip()

        return {"score": score, "reason": reason}

    except Exception as e:
        print("AI ERROR:", e)
        return {"score": 5.0, "reason": "error"}