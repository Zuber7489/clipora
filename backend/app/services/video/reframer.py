import cv2
import numpy as np
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

class FaceReframer:
    """
    Intelligently analyzes video frames to track speaker faces
    and compute smooth 9:16 vertical crop coordinates.
    """
    _face_cascade = None

    @classmethod
    def _get_cascade(cls):
        if cls._face_cascade is None:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            cls._face_cascade = cv2.CascadeClassifier(cascade_path)
        return cls._face_cascade

    @classmethod
    def calculate_speaker_crop_x(
        cls,
        video_path: Path,
        start_time: float,
        end_time: float,
        src_width: int,
        src_height: int,
        target_aspect: float = 9.0 / 16.0,
        sample_interval: float = 1.5
    ) -> float:
        """
        Samples frames within the clip duration to find speaker center of mass (X-axis).
        Returns normalized or pixel center-X smoothed offset for crop filter.
        """
        default_center_x = src_width / 2.0
        
        # Calculate target crop width for height = src_height
        crop_w = int(src_height * target_aspect)
        if crop_w >= src_width:
            return default_center_x

        if not video_path.exists():
            return default_center_x

        cascade = cls._get_cascade()
        if cascade.empty():
            return default_center_x

        face_centers_x: List[float] = []

        try:
            cap = cv2.VideoCapture(str(video_path))
            if not cap.isOpened():
                return default_center_x

            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)

            start_frame = int(start_time * fps)
            end_frame = min(int(total_frames), int(end_time * fps))
            step_frames = max(1, int(fps * sample_interval))

            for frame_idx in range(start_frame, end_frame, step_frames):
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()
                if not ret or frame is None:
                    continue

                # Resize for fast detection
                h, w = frame.shape[:2]
                scale = 480.0 / max(h, 1)
                small = cv2.resize(frame, (int(w * scale), 480))
                gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

                faces = cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.2,
                    minNeighbors=4,
                    minSize=(30, 30)
                )

                if len(faces) > 0:
                    # Pick largest face (primary speaker)
                    largest_face = max(faces, key=lambda b: b[2] * b[3])
                    fx, fy, fw, fh = largest_face
                    # Scale center X back to original dimensions
                    orig_face_center_x = (fx + fw / 2.0) / scale
                    face_centers_x.append(orig_face_center_x)

            cap.release()
        except Exception as e:
            logger.warning(f"Face detection encountered error: {e}. Falling back to center crop.")
            return default_center_x

        if not face_centers_x:
            return default_center_x

        # Median center to reject outliers
        median_x = float(np.median(face_centers_x))

        # Clamp so crop doesn't exceed image boundaries
        half_crop = crop_w / 2.0
        clamped_x = max(half_crop, min(src_width - half_crop, median_x))
        return clamped_x
