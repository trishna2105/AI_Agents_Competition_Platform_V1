#The below code is for base 64 type image upload for yaml file, not needed for skills.md
'''
import time
import uuid
import requests
import vertexai
from supabase import create_client
from vertexai.preview.vision_models import ImageGenerationModel
from backend.app.utils.config import SUPABASE_URL, SUPABASE_KEY, HF_API_URL, HF_TOKEN, VERTEX_PROJECT, VERTEX_LOCATION

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def init_vertex():
    vertexai.init(project=VERTEX_PROJECT, location=VERTEX_LOCATION)

def upload_image(file_name, image_bytes):
    supabase.storage.from_("images").upload(
        file_name,
        image_bytes,
        {"content-type": "image/png", "upsert": "true"}  # upsert prevents 409 on retries
    )
    return supabase.storage.from_("images").get_public_url(file_name)

def generate_image_from_vertex(prompt):
    init_vertex()
    model = ImageGenerationModel.from_pretrained("imagen-4.0-fast-generate-001")
    images = model.generate_images(prompt=prompt)
    file_name = f"{uuid.uuid4()}.png"
    return upload_image(file_name, images[0]._image_bytes)

def generate_image_from_hf(prompt):
    try:
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}
        response = requests.post(
            HF_API_URL,
            headers=headers,
            json={"inputs": prompt}
        )
        if response.status_code != 200:
            return generate_image_from_vertex(prompt)
        file_name = f"hf_{int(time.time())}.png"
        return upload_image(file_name, response.content)
    except Exception:
        return generate_image_from_vertex(prompt)

def generate_image(model_name, prompt):
    if model_name == "huggingface":
        return generate_image_from_hf(prompt)
    return generate_image_from_vertex(prompt)
'''
import time
import uuid
import requests
import vertexai

from supabase import create_client
from vertexai.preview.vision_models import ImageGenerationModel

from backend.app.utils.config import SUPABASE_URL, SUPABASE_KEY, HF_API_URL, HF_TOKEN, VERTEX_PROJECT, VERTEX_LOCATION


supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def init_vertex():
    vertexai.init(project=VERTEX_PROJECT, location=VERTEX_LOCATION)


def upload_image(file_name, image_bytes):
    supabase.storage.from_("images").upload(
        file_name,
        image_bytes,
        {"content-type": "image/png"}
    )
    return supabase.storage.from_("images").get_public_url(file_name)


def generate_image_from_vertex(prompt):
    init_vertex()

    model = ImageGenerationModel.from_pretrained("imagen-4.0-fast-generate-001")
    images = model.generate_images(prompt=prompt)

    file_name = f"{uuid.uuid4()}.png"
    return upload_image(file_name, images[0]._image_bytes)


def generate_image_from_hf(prompt):
    try:
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}

        response = requests.post(
            HF_API_URL,
            headers=headers,
            json={"inputs": prompt}
        )

        if response.status_code != 200:
            return generate_image_from_vertex(prompt)

        file_name = f"hf_{int(time.time())}.png"
        return upload_image(file_name, response.content)

    except Exception:
        return generate_image_from_vertex(prompt)


def generate_image(model_name, prompt):
    if model_name == "huggingface":
        return generate_image_from_hf(prompt)
    return generate_image_from_vertex(prompt)
