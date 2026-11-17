import re
from pathlib import Path
from typing import Dict, Any, List

class VttSubtitleParser:
    @staticmethod
    def parse_time(ts_str: str) -> float:
        parts = ts_str.strip().split(':')
        if len(parts) == 3:
            h, m, s = parts
            return int(h) * 3600 + int(m) * 60 + float(s)
        elif len(parts) == 2:
            m, s = parts
            return int(m) * 60 + float(s)
        return 0.0

    @classmethod
    def parse_file(cls, vtt_path: Path) -> Dict[str, Any]:
        """
        Parses a WebVTT or SRT subtitle file into structured word-level timestamps.
        Extracts real words, speaker indications, and timings.
        """
        if not vtt_path.exists():
            return {"full_text": "", "words": []}

        content = vtt_path.read_text(encoding="utf-8", errors="replace")
        blocks = re.split(r'\n\s*\n', content)
        words: List[Dict[str, Any]] = []
        full_text_pieces: List[str] = []

        for block in blocks:
            lines = [l.strip() for l in block.strip().split('\n') if l.strip()]
            if not lines:
                continue
            if lines[0].startswith("WEBVTT") or lines[0].startswith("Kind:") or lines[0].startswith("Language:"):
                continue

            time_line = None
            for l in lines:
                if '-->' in l:
                    time_line = l
                    break
            if not time_line:
                continue

            m = re.match(r'(\d+:\d+[\d\.:]*)\s*-->\s*(\d+:\d+[\d\.:]*)', time_line)
            if not m:
                continue

            blk_start = cls.parse_time(m.group(1))
            blk_end = cls.parse_time(m.group(2))
            blk_dur = max(0.2, blk_end - blk_start)

            text_lines = [l for l in lines if '-->' not in l and not re.match(r'^\d+$', l)]
            raw_text = ' '.join(text_lines)

            # Strip auditory sound effects like [तालियां], [म्यूजिक], [हंसी]
            cleaned_text = re.sub(r'\[.*?\]', '', raw_text)
            cleaned_text = re.sub(r'\(.*?\)', '', cleaned_text).strip()
            if not cleaned_text:
                continue

            full_text_pieces.append(cleaned_text)

            # Check for inline word timestamps: <HH:MM:SS.mmm><c> word</c>
            if '<c>' in cleaned_text:
                tokens = re.findall(r'(?:<(\d+:\d+[\d\.:]*)><c>)?\s*([^<]+?)(?:</c>|$)', cleaned_text)
                curr_t = blk_start
                for ts_match, word_txt in tokens:
                    w = word_txt.strip()
                    if not w:
                        continue
                    if ts_match:
                        curr_t = cls.parse_time(ts_match)
                    words.append({
                        "word": w,
                        "start": round(curr_t, 2),
                        "end": round(min(blk_end, curr_t + 0.35), 2),
                        "speaker": "Speaker"
                    })
            else:
                # Standard line-level caption: distribute words evenly across block duration
                plain_tokens = [t.strip() for t in cleaned_text.split() if t.strip()]
                if plain_tokens:
                    time_per_word = blk_dur / len(plain_tokens)
                    for i, tok in enumerate(plain_tokens):
                        w_start = blk_start + (i * time_per_word)
                        w_end = w_start + time_per_word
                        words.append({
                            "word": tok,
                            "start": round(w_start, 2),
                            "end": round(w_end, 2),
                            "speaker": "Speaker"
                        })

        return {
            "full_text": " ".join(full_text_pieces),
            "words": words
        }
