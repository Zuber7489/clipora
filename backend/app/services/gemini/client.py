import os
import time
from pathlib import Path
from typing import Optional
from google import genai
from google.genai import types
from backend.app.core.config import settings

class GeminiClientWrapper:
    _client: Optional[genai.Client] = None

    @classmethod
    def get_client(cls) -> Optional[genai.Client]:
        """Returns initialized Gemini client or None if API key is missing."""
        api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            return None
        
        if cls._client is None:
            cls._client = genai.Client(api_key=api_key)
        return cls._client

    @classmethod
    def upload_and_wait(cls, file_path: Path, mime_type: str = "video/mp4") -> Optional[types.File]:
        """
        Uploads file via Gemini Files API and polls until processing state is ACTIVE.
        """
        client = cls.get_client()
        if not client:
            return None

        uploaded_file = client.files.upload(
            file=str(file_path),
            config=types.UploadFileConfig(mime_type=mime_type)
        )

        # Poll file state until ACTIVE or FAILED
        max_retries = 60 # up to 5 minutes
        retries = 0
        while uploaded_file.state and uploaded_file.state.name != "ACTIVE":
            if uploaded_file.state.name == "FAILED":
                raise RuntimeError(f"Gemini file processing failed: {uploaded_file.name}")
            time.sleep(5)
            uploaded_file = client.files.get(name=uploaded_file.name)
            retries += 1
            if retries > max_retries:
                raise TimeoutError("Gemini file processing timed out.")

        return uploaded_file
