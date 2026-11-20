from typing import List, Dict, Any, Optional

class ClipRankingEngine:
    WEIGHT_HOOK = 0.25
    WEIGHT_EMOTION = 0.20
    WEIGHT_VALUE = 0.20
    WEIGHT_CONTEXT = 0.15
    WEIGHT_STORY = 0.10
    WEIGHT_ENDING = 0.10

    @classmethod
    def calculate_score(cls, candidate: Dict[str, Any]) -> int:
        """Calculates composite heuristic score based on the 6 weighted pillars."""
        hook = candidate.get("hook_score", 70)
        emotion = candidate.get("emotion_score", 70)
        value = candidate.get("value_score", 70)
        context = candidate.get("context_score", 70)
        story = candidate.get("story_score", 70)
        ending = candidate.get("ending_score", 70)

        composite = (
            hook * cls.WEIGHT_HOOK +
            emotion * cls.WEIGHT_EMOTION +
            value * cls.WEIGHT_VALUE +
            context * cls.WEIGHT_CONTEXT +
            story * cls.WEIGHT_STORY +
            ending * cls.WEIGHT_ENDING
        )
        return int(round(composite))

    @classmethod
    def rank_and_select_top_clips(
        cls,
        candidates: List[Dict[str, Any]],
        target_count: int = 5,
        video_duration: float = 3600.0,
        target_duration: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Validates timestamps, calculates scores, and selects the top clips with
        guaranteed temporal diversity across the ENTIRE video timeline (beginning,
        middle, climax, and ending) rather than clustering at the start.
        """
        valid_candidates = []
        for c in candidates:
            start = float(c.get("start_time", 0.0))
            end = float(c.get("end_time", 0.0))
            duration = end - start
            
            # Validation criteria
            if start < 0 or end > video_duration or duration < 10.0:
                continue

            # Update score with duration alignment bonus
            base_score = cls.calculate_score(c)
            if target_duration:
                diff = abs(duration - target_duration)
                if diff <= 6:
                    base_score = min(99, base_score + 5)
                elif diff <= 15:
                    base_score = min(99, base_score + 2)

            c["viral_score"] = base_score
            c["duration"] = round(duration, 2)
            valid_candidates.append(c)

        if not valid_candidates:
            return []

        # Sort descending by viral score
        valid_candidates.sort(key=lambda x: x["viral_score"], reverse=True)

        selected: List[Dict[str, Any]] = []

        # --- TIMELINE BUCKET PARTITIONING FOR LONG VIDEOS (>= 3 minutes) ---
        if video_duration >= 180.0 and len(valid_candidates) >= target_count:
            bucket_size = video_duration / float(target_count)
            buckets = [[] for _ in range(target_count)]

            for cand in valid_candidates:
                mid = (cand["start_time"] + cand["end_time"]) / 2.0
                b_idx = min(target_count - 1, int(mid // bucket_size))
                buckets[b_idx].append(cand)

            # Phase 1: Pick the #1 highest-scoring candidate from each timeline bucket
            for b_idx in range(target_count):
                bucket_cands = buckets[b_idx]
                if not bucket_cands:
                    continue
                # Pick the best in this bucket that doesn't overlap with already selected
                for cand in bucket_cands:
                    c_start = cand["start_time"]
                    c_end = cand["end_time"]
                    overlap = False
                    for s in selected:
                        s_start = s["start_time"]
                        s_end = s["end_time"]
                        overlap_dur = max(0.0, min(c_end, s_end) - max(c_start, s_start))
                        if overlap_dur > 5.0 or abs(c_start - s_start) < 30.0:
                            overlap = True
                            break
                    if not overlap:
                        cand["is_selected"] = True
                        selected.append(cand)
                        break

        # Phase 2: Backfill any remaining slots from highest scoring available candidates
        # enforcing temporal spacing so multiple clips don't pile up in the same 60 seconds
        for cand in valid_candidates:
            if len(selected) >= target_count:
                break
            if cand in selected:
                continue

            c_start = cand["start_time"]
            c_end = cand["end_time"]
            overlap = False
            for s in selected:
                s_start = s["start_time"]
                s_end = s["end_time"]
                overlap_dur = max(0.0, min(c_end, s_end) - max(c_start, s_start))
                min_gap = 45.0 if video_duration >= 600.0 else 10.0
                if overlap_dur > 5.0 or abs(c_start - s_start) < min_gap:
                    overlap = True
                    break

            if not overlap:
                cand["is_selected"] = True
                selected.append(cand)

        # Fallback if still under target_count
        if len(selected) < target_count:
            for cand in valid_candidates:
                if cand not in selected and len(selected) < target_count:
                    cand["is_selected"] = True
                    selected.append(cand)

        # Sort the chosen clips chronologically by start_time
        selected.sort(key=lambda x: x["start_time"])
        return selected
