import logging
import uuid
from pathlib import Path
from typing import Optional
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class FirebaseStorageService:
    """
    Handles seamless uploads to Google Cloud / Firebase Storage.
    Provides free, ultra-fast CDN download URLs for rendered clips.
    """
    _initialized: bool = False
    _bucket = None

    @classmethod
    def _init_firebase(cls) -> bool:
        if cls._initialized:
            return cls._bucket is not None

        bucket_name = getattr(settings, "FIREBASE_STORAGE_BUCKET", None)
        creds_path = getattr(settings, "FIREBASE_SERVICE_ACCOUNT_PATH", None)

        if not bucket_name:
            logger.info("Firebase Storage not configured (FIREBASE_STORAGE_BUCKET is empty). Using local storage.")
            cls._initialized = True
            return False

        try:
            import firebase_admin
            from firebase_admin import credentials, storage

            if not firebase_admin._apps:
                if creds_path and Path(creds_path).exists():
                    cred = credentials.Certificate(creds_path)
                    firebase_admin.initialize_app(cred, {'storageBucket': bucket_name})
                else:
                    # Initialize default / application default credentials
                    firebase_admin.initialize_app(options={'storageBucket': bucket_name})

            cls._bucket = storage.bucket()
            cls._initialized = True
            logger.info(f"Firebase Storage successfully initialized on bucket: {bucket_name}")
            return True
        except Exception as e:
            logger.warning(f"Could not initialize Firebase Storage: {e}. Falling back to local storage.")
            cls._initialized = True
            cls._bucket = None
            return False

    @classmethod
    def upload_file(cls, local_path: Path, destination_name: str, content_type: Optional[str] = None) -> Optional[str]:
        """
        Uploads local video or thumbnail to Firebase Storage and returns public CDN URL.
        Returns None if Firebase is not configured.
        """
        if not cls._init_firebase() or cls._bucket is None:
            return None

        if not local_path.exists():
            logger.error(f"Cannot upload non-existent file to Firebase: {local_path}")
            return None

        try:
            blob = cls._bucket.blob(destination_name)
            
            # Generate download token for Firebase Storage URL format
            download_token = str(uuid.uuid4())
            metadata = {"firebaseStorageDownloadTokens": download_token}
            blob.metadata = metadata

            if content_type:
                blob.content_type = content_type
            elif local_path.suffix.lower() == ".mp4":
                blob.content_type = "video/mp4"
            elif local_path.suffix.lower() in [".jpg", ".jpeg"]:
                blob.content_type = "image/jpeg"

            blob.upload_from_filename(str(local_path))
            
            bucket_name = cls._bucket.name
            # Construct Firebase public CDN download URL
            from urllib.parse import quote
            safe_blob_name = quote(destination_name, safe='')
            public_url = (
                f"https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/{safe_blob_name}"
                f"?alt=media&token={download_token}"
            )
            logger.info(f"Successfully uploaded {local_path.name} to Firebase Storage: {public_url}")
            return public_url
        except Exception as e:
            logger.error(f"Failed to upload {local_path.name} to Firebase Storage: {e}")
            return None
