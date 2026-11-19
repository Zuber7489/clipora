import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
from backend.app.services.subtitles.transliterate import devanagari_to_hinglish
from backend.app.services.subtitles.presets import (
    get_preset,
    resolve_preset_name,
    SubtitlePreset,
    PRESETS
)

class SubtitleGenerator:
    """
    Generates ultra-engaging, viral-retention Advanced SubStation Alpha (.ass) subtitles.
    Supports Alex Hormozi (highlight box), MrBeast (bouncy pop), Ali Abdaal (clean minimal),
    and Neon Cyber styles, word-level highlight/animations, emoji injection, and custom user-edited transcript payloads.
    """

    EMOJI_MAP = {
        "roast": "💀", "hasi": "🤣", "funny": "😂", "lol": "😂", "joke": "🤣",
        "khatam": "💀", "dead": "💀", "rip": "💀", "destroy": "💀", "pagal": "🤪",
        "fire": "🔥", "lit": "🔥", "epic": "🔥", "aag": "🔥", "banger": "🔥",
        "paisa": "💰", "money": "💰", "crore": "💰", "lakh": "💰", "cash": "💸",
        "kya": "👀", "shock": "🤯", "secret": "🤫", "shh": "🤫", "twist": "⚡",
        "win": "👑", "best": "💯", "top": "🎯", "perfect": "✨", "sahi": "✅",
        "warning": "⚠️", "danger": "🚨", "khatra": "⚠️", "alert": "🚨",
        "love": "❤️", "dil": "❤️", "dost": "🤝", "fight": "🥊",
        "bhai": "🤝", "bro": "🤝", "season": "🍿", "show": "🎬", "stage": "🎤",
        "sam": "🎤", "latents": "🎭", "scene": "👀", "comedy": "🤣", "standup": "🎙️",
        "hero": "🦸", "star": "⭐", "super": "⚡", "real": "💯", "wah": "👏",
        "arre": "😲", "suno": "👂", "dekh": "👀", "mast": "🔥", "bawaal": "💥", "faad": "🔥"
    }

    GREEN_TRIGGERS = {
        'paisa', 'money', 'crore', 'lakh', 'cash', 'rich', 'win', 'best', 'top',
        'profit', 'success', 'super', 'deal', 'million', 'billion', '100', 'sahi',
        'king', 'great', 'bada', 'growth', 'kamyab', 'hit', 'mast', 'star',
        'secret', 'scale', 'revenue', 'dollar', 'dollars', 'growth', 'smart', 'viral'
    }

    RED_TRIGGERS = {
        'roast', 'dead', 'khatam', 'destroy', 'galti', 'danger', 'hate', 'stop',
        'fail', 'mar', 'khatra', 'shock', 'warning', 'bad', 'loss', 'rip',
        'pagal', 'worst', 'lose', 'no', 'never', 'galat', 'dhoka', 'chup', 'bawaal',
        'insane', 'crazy', 'disaster', 'scam', 'wrong', 'mistake', 'shocking', 'kill'
    }

    @classmethod
    def _inject_emoji(cls, word: str) -> str:
        clean = re.sub(r'[^a-zA-Z0-9\u0900-\u097F]', '', word).lower()
        matched_emoji = cls.EMOJI_MAP.get(clean)
        if not matched_emoji:
            for key, emoji in cls.EMOJI_MAP.items():
                if len(key) >= 4 and key in clean:
                    matched_emoji = emoji
                    break
        if matched_emoji:
            return f"{word} {{\\fnSegoe UI Emoji}}{matched_emoji}{{\\fn}}"
        return word

    @classmethod
    def _get_highlight_bgr(cls, word: str, default_bgr: str) -> str:
        clean = re.sub(r'[^a-zA-Z0-9\u0900-\u097F]', '', word).lower()
        if clean in cls.GREEN_TRIGGERS or any(t in clean for t in cls.GREEN_TRIGGERS if len(t) >= 4):
            return "&H0055FF00&"  # Vibrant Neon Lime Green
        if clean in cls.RED_TRIGGERS or any(t in clean for t in cls.RED_TRIGGERS if len(t) >= 4):
            return "&H003333FF&"  # Coral / Fire Red
        return default_bgr

    @staticmethod
    def _format_timestamp(seconds: float) -> str:
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        centisecs = int(round((seconds - int(seconds)) * 100))
        if centisecs >= 100:
            centisecs = 99
        return f"{hrs}:{mins:02d}:{secs:02d}.{centisecs:02d}"

    @classmethod
    def generate_ass(
        cls,
        words: List[Dict[str, Any]],
        output_path: Union[Path, str],
        style_name: str = "bold_viral",
        clip_start: float = 0.0,
        clip_end: float = 60.0,
        headline_hook: Optional[str] = None,
        video_width: int = 1080,
        video_height: int = 1920
    ) -> Path:
        """
        Generates high-retention .ass subtitle file with preset styling and smooth animations.
        """
        out_file = Path(output_path)
        out_file.parent.mkdir(parents=True, exist_ok=True)

        preset: SubtitlePreset = get_preset(style_name)
        canonical_style = preset.name

        rel_duration = max(1.0, clip_end - clip_start)
        rel_duration_str = cls._format_timestamp(rel_duration)

        clip_words = []
        first_start = float(words[0].get("start", 0.0)) if words else 0.0
        is_already_relative = (first_start < 5.0 and clip_start > 15.0)

        for w in words:
            raw_word = str(w.get("word", "")).strip()
            if not raw_word or raw_word in ("...", "."):
                continue

            w_start = float(w.get("start", 0.0))
            w_end = float(w.get("end", 0.0))

            if is_already_relative:
                rel_start = max(0.0, w_start)
                rel_end = max(rel_start + 0.15, min(rel_duration, w_end))
            else:
                if w_end <= clip_start or w_start >= clip_end:
                    continue
                rel_start = max(0.0, w_start - clip_start)
                rel_end = max(rel_start + 0.15, min(rel_duration, w_end - clip_start))

            clean_word = devanagari_to_hinglish(raw_word)
            clean_word = cls._inject_emoji(clean_word)

            clip_words.append({
                "word": clean_word,
                "start": rel_start,
                "end": rel_end,
                "speaker": w.get("speaker", "Speaker")
            })

        if not clip_words:
            header = f"""[Script Info]
Title: ClipForge Viral Subtitles
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
PlayResX: {video_width}
PlayResY: {video_height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{preset.to_ass_style_line("Default")}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
            out_file.write_text(header, encoding="utf-8")
            return out_file

        # Chunk phrases naturally based on preset specifications
        phrases: List[List[Dict[str, Any]]] = []
        current_phrase: List[Dict[str, Any]] = []
        current_chars = 0
        max_words = preset.max_words_per_phrase
        max_chars = preset.max_chars_per_phrase

        for idx, word_obj in enumerate(clip_words):
            word_text = word_obj["word"]
            if current_phrase:
                gap = word_obj["start"] - current_phrase[-1]["end"]
                if gap > 0.40 or len(current_phrase) >= max_words or (current_chars + len(word_text)) > max_chars:
                    phrases.append(current_phrase)
                    current_phrase = []
                    current_chars = 0

            current_phrase.append(word_obj)
            current_chars += len(word_text) + 1

        if current_phrase:
            phrases.append(current_phrase)

        header = f"""[Script Info]
Title: ClipForge Viral Subtitles
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
PlayResX: {video_width}
PlayResY: {video_height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{preset.to_ass_style_line("Default")}
"""
        dialogue_lines: List[str] = []

        default_active_bgr = preset.primary_color

        for idx, phrase in enumerate(phrases):
            line_start = phrase[0]["start"]
            if idx + 1 < len(phrases):
                next_start = phrases[idx + 1][0]["start"]
                line_end = min(next_start, max(phrase[-1]["end"] + 0.30, line_start + 1.0))
            else:
                line_end = min(rel_duration, phrase[-1]["end"] + 0.35)

            kf_word_parts = []
            line_start_ms = int(line_start * 1000)

            for i, w in enumerate(phrase):
                w_start = w["start"]
                if i + 1 < len(phrase):
                    dur = max(0.12, phrase[i + 1]["start"] - w_start)
                else:
                    dur = max(0.15, w["end"] - w_start)

                cs = max(10, int(round(dur * 100)))
                raw_w = w["word"]
                display_word = raw_w.upper() if preset.uppercase else raw_w

                custom_bgr = cls._get_highlight_bgr(raw_w, default_active_bgr)
                color_tag = f"\\1c{custom_bgr}" if custom_bgr != default_active_bgr else ""

                # MrBeast Bouncy Pop Animation
                anim_tags = ""
                if preset.has_bounce:
                    w_rel_start_ms = max(0, int(w_start * 1000) - line_start_ms)
                    t_pop_end = w_rel_start_ms + 120
                    t_settle_end = t_pop_end + 100
                    anim_tags = f"\\t({w_rel_start_ms},{t_pop_end},\\fscx125\\fscy125)\\t({t_pop_end},{t_settle_end},\\fscx100\\fscy100)"

                # Neon glow
                glow_tag = f"\\blur{int(preset.blur)}" if preset.has_glow and preset.blur > 0 else ""

                tags = f"{{{anim_tags}{glow_tag}{color_tag}\\kf{cs}}}"
                kf_word_parts.append(f"{tags}{display_word}")

            formatted_text = " ".join(kf_word_parts)
            start_str = cls._format_timestamp(line_start)
            end_str = cls._format_timestamp(line_end)
            dialogue_lines.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{formatted_text}")

        content = (
            header
            + "\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
            + "\n".join(dialogue_lines)
            + "\n"
        )
        out_file.write_text(content, encoding="utf-8")
        return out_file
