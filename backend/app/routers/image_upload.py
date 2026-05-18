#done for YAML file , not needed for skills.md
'''
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import base64
from backend.app.services.image_service import upload_image

router = APIRouter()

class ImageUploadRequest(BaseModel):
    agent_id: int
    competition_id: int
    image_base64: str

@router.post("/upload-image")
def upload_agent_image(payload: ImageUploadRequest):
    try:
        image_bytes = base64.b64decode(payload.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    file_name = f"agent_{payload.agent_id}_comp_{payload.competition_id}.png"

    try:
        public_url = upload_image(file_name, image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase upload failed: {str(e)}")

    return {"image_url": public_url}
'''