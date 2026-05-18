def sse(text: str):
    return "data: " + text.replace("\n", "\ndata: ") + "\n\n"


def split_generation_text(text: str):
    if not text or "FINAL_IMAGE_PROMPT:" not in text:
        return (text or "").strip(), ""

    reasoning, final_prompt = text.split("FINAL_IMAGE_PROMPT:", 1)
    return reasoning.strip(), final_prompt.strip()