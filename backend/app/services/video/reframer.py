import cv2
import numpy as np
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

class FaceReframer:
    """
    Intelligently analyzes video frames using MediaPipe BlazeFace (with defensive OpenCV fallback)
    to track speaker faces, compute smooth crop trajectories, and calculate multi-speaker split layouts.
    """
    _shared_instance: Optional["FaceReframer"] = None
    _face_cascade = None

    def __init__(self, min_detection_confidence: float = 0.5):
        self.min_detection_confidence = min_detection_confidence
        self._mp_face_detector = None
        self._init_mediapipe()

    def _init_mediapipe(self):
        try:
            import mediapipe as mp
            self._mp_face_detector = mp.solutions.face_detection.FaceDetection(
                model_selection=0,
                min_detection_confidence=self.min_detection_confidence
            )
        except Exception as e:
            logger.warning(f"MediaPipe FaceDetection initialization failed: {e}. Will use OpenCV fallback if available.")
            self._mp_face_detector = None

    def close(self):
        if self._mp_face_detector is not None:
            try:
                self._mp_face_detector.close()
            except Exception:
                pass
            self._mp_face_detector = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    @classmethod
    def get_shared_instance(cls) -> "FaceReframer":
        if cls._shared_instance is None or cls._shared_instance._mp_face_detector is None:
            cls._shared_instance = cls()
        return cls._shared_instance

    @classmethod
    def _get_cascade(cls):
        if cls._face_cascade is None:
            if hasattr(cv2, "CascadeClassifier") and hasattr(cv2, "data") and hasattr(cv2.data, "haarcascades"):
                cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
                if Path(cascade_path).exists():
                    try:
                        cascade = cv2.CascadeClassifier(cascade_path)
                        if not cascade.empty():
                            cls._face_cascade = cascade
                    except Exception:
                        cls._face_cascade = None
        return cls._face_cascade

    def detect_faces(self, frame: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detects faces in a BGR frame.
        Returns list of bounding boxes: (x, y, w, h) sorted largest area first.
        """
        if frame is None or not isinstance(frame, np.ndarray) or frame.size == 0:
            return []

        h, w = frame.shape[:2]
        if h <= 0 or w <= 0:
            return []

        # 1. MediaPipe BlazeFace Primary Engine
        if self._mp_face_detector is not None:
            try:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = self._mp_face_detector.process(rgb_frame)
                if results and results.detections:
                    boxes: List[Tuple[int, int, int, int]] = []
                    for detection in results.detections:
                        bbox = detection.location_data.relative_bounding_box
                        bx = int(max(0, bbox.xmin * w))
                        by = int(max(0, bbox.ymin * h))
                        bw = int(min(w - bx, bbox.width * w))
                        bh = int(min(h - by, bbox.height * h))
                        if bw > 10 and bh > 10:
                            boxes.append((bx, by, bw, bh))
                    if boxes:
                        boxes.sort(key=lambda b: b[2] * b[3], reverse=True)
                        return boxes
            except Exception as e:
                logger.debug(f"MediaPipe face detection pass failed: {e}")

        # 2. Defensive OpenCV Haar Fallback
        cascade = self._get_cascade()
        if cascade is not None:
            try:
                scale = 480.0 / max(h, 1)
                small = cv2.resize(frame, (int(w * scale), 480))
                gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
                detected = cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.2,
                    minNeighbors=4,
                    minSize=(30, 30)
                )
                if len(detected) > 0:
                    orig_boxes = [
                        (int(x / scale), int(y / scale), int(bw / scale), int(bh / scale))
                        for (x, y, bw, bh) in detected
                    ]
                    orig_boxes.sort(key=lambda b: b[2] * b[3], reverse=True)
                    return orig_boxes
            except Exception as e:
                logger.debug(f"OpenCV cascade face detection failed: {e}")

        return []

    @classmethod
    def calculate_speaker_crop_x(
        cls,
        video_path: Path,
        start_time: float,
        end_time: float,
        src_width: int,
        src_height: int,
        target_aspect: float = 9.0 / 16.0,
        sample_interval: float = 1.0
    ) -> float:
        """
        Samples frames within clip duration to find primary speaker center of mass (X-axis).
        Returns pixel center-X smoothed offset for crop filter clamped within boundaries.
        """
        default_center_x = src_width / 2.0
        crop_w = int(src_height * target_aspect)
        if crop_w >= src_width:
            return default_center_x

        if not Path(video_path).exists():
            return default_center_x

        reframer = cls.get_shared_instance()
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

                faces = reframer.detect_faces(frame)
                if faces:
                    fx, fy, fw, fh = faces[0]  # Largest face
                    face_centers_x.append(fx + fw / 2.0)

            cap.release()
        except Exception as e:
            logger.warning(f"Face tracking encountered error: {e}. Defaulting to center crop.")
            return default_center_x

        if not face_centers_x:
            return default_center_x

        median_x = float(np.median(face_centers_x))
        half_crop = crop_w / 2.0
        return float(max(half_crop, min(src_width - half_crop, median_x)))

    @classmethod
    def get_dynamic_crop_trajectory(
        cls,
        video_path: Path,
        start_time: float,
        end_time: float,
        crop_w: int,
        crop_h: int,
        fps_sample: float = 2.0,
        smooth_window: int = 5
    ) -> List[float]:
        """
        Calculates a smoothed trajectory of crop X coordinates across time.
        """
        meta_cap = cv2.VideoCapture(str(video_path))
        if not meta_cap.isOpened():
            return [crop_w / 2.0]
        src_w = int(meta_cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or crop_w
        fps = meta_cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(meta_cap.get(cv2.CAP_PROP_FRAME_COUNT))
        meta_cap.release()

        half_crop = crop_w / 2.0
        default_x = src_w / 2.0

        raw_positions: List[float] = []
        step_frames = max(1, int(fps / fps_sample))
        start_frame = int(start_time * fps)
        end_frame = min(total_frames, int(end_time * fps))

        reframer = cls.get_shared_instance()
        cap = cv2.VideoCapture(str(video_path))

        last_known_x = default_x
        for f_idx in range(start_frame, end_frame, step_frames):
            cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
            ret, frame = cap.read()
            if ret and frame is not None:
                faces = reframer.detect_faces(frame)
                if faces:
                    fx, fy, fw, fh = faces[0]
                    last_known_x = fx + fw / 2.0
            raw_positions.append(last_known_x)
        cap.release()

        if not raw_positions:
            return [default_x]

        # Moving average filter for trajectory smoothing
        smoothed: List[float] = []
        for i in range(len(raw_positions)):
            start_idx = max(0, i - smooth_window // 2)
            end_idx = min(len(raw_positions), i + smooth_window // 2 + 1)
            avg_x = float(np.mean(raw_positions[start_idx:end_idx]))
            clamped = max(half_crop, min(src_w - half_crop, avg_x))
            smoothed.append(clamped)

        return smoothed

    @classmethod
    def calculate_multi_speaker_crop_x(
        cls,
        video_path: Path,
        start_time: float,
        end_time: float,
        src_width: int,
        src_height: int,
        sample_interval: float = 1.0
    ) -> Tuple[float, float]:
        """
        Detects two primary speakers in horizontal podcast video (Host on left, Guest on right).
        Returns (speaker_a_x, speaker_b_x).
        """
        default_left = src_width * 0.30
        default_right = src_width * 0.70

        if not Path(video_path).exists():
            return default_left, default_right

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            return default_left, default_right

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        start_frame = int(start_time * fps)
        end_frame = min(int(cap.get(cv2.CAP_PROP_FRAME_COUNT)), int(end_time * fps))
        step_frames = max(1, int(fps * sample_interval))

        reframer = cls.get_shared_instance()
        all_centers: List[float] = []

        for frame_idx in range(start_frame, end_frame, step_frames):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret or frame is None:
                continue

            faces = reframer.detect_faces(frame)
            for (fx, fy, fw, fh) in faces[:2]:
                all_centers.append(fx + fw / 2.0)

        cap.release()

        if len(all_centers) < 2:
            return default_left, default_right

        mid = src_width / 2.0
        left_faces = [cx for cx in all_centers if cx < mid]
        right_faces = [cx for cx in all_centers if cx >= mid]

        spk_a = float(np.median(left_faces)) if left_faces else default_left
        spk_b = float(np.median(right_faces)) if right_faces else default_right
        return spk_a, spk_b
