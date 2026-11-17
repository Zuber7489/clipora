import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.app.services.subtitles.transliterate import devanagari_to_hinglish

class SubtitleGenerator:
    """
    Generates ultra-engaging, viral-retention Advanced SubStation Alpha (.ass) subtitles.
    Features:
    - 2-3 word rapid punchy eye-locking phrases
    - Elastic bouncy spring pop animation on active spoken words
    - Tri-Color dynamic emotional highlighting (Hormozi style: Green for Money/Wins, Red for Roasts/Shocks, Yellow for Core)
    - Contextual auto-emoji injection
    - Top hook headline banner card
    - Full support for Hindi, Hinglish, and English unicode typography
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
        'king', 'great', 'bada', 'growth', 'kamyab', 'hit', 'mast', 'star'
    }

    RED_TRIGGERS = {
        'roast', 'dead', 'khatam', 'destroy', 'galti', 'danger', 'hate', 'stop',
        'fail', 'mar', 'khatra', 'shock', 'warning', 'bad', 'loss', 'rip',
        'pagal', 'worst', 'lose', 'no', 'never', 'galat', 'dhoka', 'chup', 'bawaal'
    }

    @classmethod
    def _inject_emoji(cls, word: str) -> str:
        clean = re.sub(r'[^a-zA-Z0-9\u0900-\u097F]', '', word).lower()
        # Direct lookup or substring match
        matched_emoji = cls.EMOJI_MAP.get(clean)
        if not matched_emoji:
            for key, emoji in cls.EMOJI_MAP.items():
                if len(key) >= 4 and key in clean:
                    matched_emoji = emoji
                    break
        if matched_emoji:
            # Wrap emoji with font switch to Segoe UI Emoji for razor-sharp rendering
            return f"{word} {{\\fnSegoe UI Emoji}}{matched_emoji}{{\\fn}}"
        return word

    @classmethod
    def _get_highlight_color(cls, word: str, default_color: str) -> str:
        clean = re.sub(r'[^a-zA-Z0-9\u0900-\u097F]', '', word).lower()
        if clean in cls.GREEN_TRIGGERS or any(t in clean for t in cls.GREEN_TRIGGERS if len(t) >= 4):
            return "\\c&H00FF55&"  # Vibrant Neon Lime Green
        if clean in cls.RED_TRIGGERS or any(t in clean for t in cls.RED_TRIGGERS if len(t) >= 4):
            return "\\c&H3333FF&"  # Electric Coral / Fire Red
        return default_color

    @staticmethod
    def _format_timestamp(seconds: float) -> str:
        """Converts float seconds to ASS timestamp format: H:MM:SS.cc"""
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
        output_path: Path,
        style_name: str = "bold_viral",
        clip_start: float = 0.0,
        clip_end: float = 60.0,
        headline_hook: Optional[str] = None
    ) -> Path:
        """
        Generates high-retention .ass subtitle file with tri-color elastic bounce animations and top hook banner.
        """
        # Filter words within the clip range
        clip_words = []
        for w in words:
            w_start = float(w.get("start", 0.0))
            w_end = float(w.get("end", 0.0))
            if w_end > clip_start and w_start < clip_end:
                rel_start = max(0.0, w_start - clip_start)
                rel_end = max(rel_start + 0.1, min(clip_end - clip_start, w_end - clip_start))
                raw_word = str(w.get("word", "")).strip()
                hinglish_word = devanagari_to_hinglish(raw_word)
                clip_words.append({
                    "word": hinglish_word,
                    "start": rel_start,
                    "end": rel_end,
                    "speaker": w.get("speaker", "Speaker")
                })

        # Duration of relative clip
        rel_duration = max(1.0, clip_end - clip_start)
        rel_duration_str = cls._format_timestamp(rel_duration)

        # 2-3 words per phrase for max retention
        phrase_word_limit = 3

        phrases: List[List[Dict[str, Any]]] = []
        current_phrase: List[Dict[str, Any]] = []

        for word_obj in clip_words:
            current_phrase.append(word_obj)
            word_text = word_obj["word"]
            if len(current_phrase) >= phrase_word_limit or word_text.endswith((".", "!", "?", "...", "-")):
                phrases.append(current_phrase)
                current_phrase = []

        if current_phrase:
            phrases.append(current_phrase)

        # Style definitions (BGR hex colors for ASS: &HBBGGRR&)
        header = """[Script Info]
Title: ClipForge Viral Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
"""
        # Top Headline Banner Style (Alignment 8 = Top Center, MarginV=140)
        top_header_style = "Style: Header,Segoe UI Black,50,&H00D7FF&,&H000000&,&H000000&,&HA0000000&,1,0,0,0,100,100,1,0,1,6,3,8,80,80,140,1\n"

        if style_name == "clean_minimal":
            styles = "Style: Default,Segoe UI,62,&HFFFFFF&,&H000000&,&H000000&,&H80000000&,1,0,0,0,100,100,0,0,3,10,0,2,80,80,420,1\n"
            base_active_color = "\\c&H00FFFF&"
            normal_color = "\\c&HFFFFFF&"
        elif style_name == "hormozi_hyper":
            # Hormozi Style: Big All-Caps, Neon Lime Green highlight, thick border
            styles = "Style: Default,Segoe UI Black,78,&HFFFFFF&,&H000000&,&H000000&,&HC0000000&,1,0,0,0,100,100,2,0,1,9,4,2,80,80,450,1\n"
            base_active_color = "\\c&H00FF55&"
            normal_color = "\\c&HFFFFFF&"
        elif style_name == "neon_cyber":
            # Neon Cyber: Electric Cyan highlight, Magenta outline
            styles = "Style: Default,Segoe UI Black,74,&H00FFFF&,&H000000&,&H990099&,&HB0000000&,1,0,0,0,100,100,1,0,1,8,4,2,80,80,450,1\n"
            base_active_color = "\\c&HFFFF00&"
            normal_color = "\\c&H00FFFF&"
        else: # bold_viral (default)
            # Bold Viral: vibrant yellow highlight, thick dark outline, high-impact bouncy pop
            styles = "Style: Default,Segoe UI Black,76,&HFFFFFF&,&H000000&,&H000000&,&HB0000000&,1,0,0,0,100,100,1,0,1,9,4,2,80,80,450,1\n"
            base_active_color = "\\c&H00D7FF&"
            normal_color = "\\c&HFFFFFF&"

        dialogue_lines: List[str] = []

        # 1. Top Hook Headline Banner (Shows throughout the clip at top center)
        if headline_hook and headline_hook.strip():
            clean_head = devanagari_to_hinglish(headline_hook.strip()).upper()
            if len(clean_head) > 42:
                clean_head = clean_head[:39] + "..."
            dialogue_lines.append(
                f"Dialogue: 0,0:00:00.00,{rel_duration_str},Header,,0,0,0,,{{\\c&H00D7FF&\\3c&H000000&\\bord6\\shad3}}{{\\fnSegoe UI Emoji}}🔥{{\\fn}} {clean_head} {{\\fnSegoe UI Emoji}}🔥{{\\fn}}"
            )

        # 2. Generate active karaoke word-pop dialogue events with Tri-Color Highlighting
        for phrase in phrases:
            for i, target_word in enumerate(phrase):
                sub_start = target_word["start"]
                sub_end = target_word["end"]
                
                text_parts = []
                for j, w in enumerate(phrase):
                    raw_w = w["word"]
                    w_with_emoji = cls._inject_emoji(raw_w)
                    display_word = w_with_emoji.upper() if style_name != "clean_minimal" else w_with_emoji

                    if i == j:
                        # Dynamic Tri-Color Highlight (Green/Red/Yellow based on emotional context)
                        active_color = cls._get_highlight_color(raw_w, base_active_color)
                        # Elastic bouncy zoom pop (120% snap)
                        text_parts.append(
                            f"{{{active_color}\\t(0,70,\\fscx120\\fscy120)\\t(70,160,\\fscx100\\fscy100)}}{display_word}{{{normal_color}\\fscx100\\fscy100}}"
                        )
                    else:
                        text_parts.append(f"{{{normal_color}}}{display_word}")
                
                formatted_text = " ".join(text_parts)
                start_str = cls._format_timestamp(sub_start)
                end_str = cls._format_timestamp(sub_end)
                dialogue_lines.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{formatted_text}")

        content = (
            header
            + top_header_style
            + styles
            + "\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
            + "\n".join(dialogue_lines)
            + "\n"
        )
        output_path.write_text(content, encoding="utf-8")
        return output_path
