from typing import List, Dict, Any

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
        video_duration: float = 3600.0
    ) -> List[Dict[str, Any]]:
        """
        Validates timestamps, calculates scores, eliminates significant overlaps,
        and selects top non-overlapping clips.
        """
        valid_candidates = []
        for c in candidates:
            start = float(c.get("start_time", 0.0))
            end = float(c.get("end_time", 0.0))
            duration = end - start
            
            # Validation criteria
            if start < 0 or end > video_duration or duration < 10.0:
                continue

            # Update score
            c["viral_score"] = cls.calculate_score(c)
            c["duration"] = round(duration, 2)
            valid_candidates.append(c)

        # Sort descending by viral score
        valid_candidates.sort(key=lambda x: x["viral_score"], reverse=True)

        # Non-overlapping greedy selection
        selected: List[Dict[str, Any]] = []
        for cand in valid_candidates:
            if len(selected) >= target_count:
                break
            
            c_start = cand["start_time"]
            c_end = cand["end_time"]
            
            # Check overlap with already selected clips (>10s overlap rejected)
            overlap = False
            for s in selected:
                s_start = s["start_time"]
                s_end = s["end_time"]
                overlap_duration = max(0.0, min(c_end, s_end) - max(c_start, s_start))
                if overlap_duration > 8.0:
                    overlap = True
                    break
            
            if not overlap:
                cand["is_selected"] = True
                selected.append(cand)

        # If fewer than target_count due to overlap filter, backfill best remaining
        if len(selected) < target_count:
            for cand in valid_candidates:
                if cand not in selected and len(selected) < target_count:
                    cand["is_selected"] = True
                    selected.append(cand)

        return selected
