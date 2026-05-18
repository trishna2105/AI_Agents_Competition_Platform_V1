import vertexai
from vertexai.generative_models import GenerativeModel
from backend.app.utils.config import VERTEX_PROJECT, VERTEX_LOCATION


def init_vertex():
    vertexai.init(project=VERTEX_PROJECT, location=VERTEX_LOCATION)


def call_gemini_stream(prompt):
    init_vertex()
    model = GenerativeModel("gemini-2.5-flash")

    for chunk in model.generate_content(prompt, stream=True):
        try:
            text = chunk.text
        except:
            text = ""

        if text:
            yield text