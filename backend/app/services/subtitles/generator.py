import os
from pathlib import Path
from typing import List, Dict, Any, Optional

class SubtitleGenerator:
    """Generates styled Advanced SubStation Alpha (.ass) subtitles with word-level highlight animation."""

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
        clip_end: float = 60.0
    ) -> Path:
        """
        Takes a list of words with {word, start, end, speaker}
        and generates an .ass file relative to the clip start time.
        """
        # Filter words within the clip range
        clip_words = []
        for w in words:
            w_start = float(w.get("start", 0.0))
            w_end = float(w.get("end", 0.0))
            if w_end > clip_start and w_start < clip_end:
                # Re-align timestamp relative to clip start
                rel_start = max(0.0, w_start - clip_start)
                rel_end = max(rel_start + 0.1, min(clip_end - clip_start, w_end - clip_start))
                clip_words.append({
                    "word": str(w.get("word", "")).strip(),
                    "start": rel_start,
                    "end": rel_end,
                    "speaker": w.get("speaker", "Speaker")
                })

        if not clip_words:
            # Fallback if no individual words: generate empty file
            output_path.write_text("[Script Info]\nTitle: Empty\n[Events]\n", encoding="utf-8")
            return output_path

        # Group words into short punchy phrases (3-6 words each for vertical 9:16 shorts)
        phrases: List[List[Dict[str, Any]]] = []
        current_phrase: List[Dict[str, Any]] = []
        phrase_word_limit = 4 if style_name == "bold_viral" else 5

        for word_obj in clip_words:
            current_phrase.append(word_obj)
            # Break on punctuation or word limit
            word_text = word_obj["word"]
            if len(current_phrase) >= phrase_word_limit or word_text.endswith((".", "!", "?", "...", "-")):
                phrases.append(current_phrase)
                current_phrase = []

        if current_phrase:
            phrases.append(current_phrase)

        # Style definition presets (BGR hex colors for ASS: &HBBGGRR&)
        # Yellow in BGR: &H00D7FF&, White: &HFFFFFF&, Dark Gray: &H101010&, Emerald: &H50E3C2&, Indigo: &HFA983A&
        header = """[Script Info]
Title: ClipForge Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
"""
        if style_name == "clean_minimal":
            # Clean Minimal: crisp white text with subtle dark translucent backing pill
            styles = "Style: Default,Arial,60,&HFFFFFF&,&H000000&,&H000000&,&H80000000&,1,0,0,0,100,100,0,0,3,10,0,2,80,80,380,1\n"
            active_color = "\\c&H00FFFF&" # Light cyan highlight
            normal_color = "\\c&HFFFFFF&"
        elif style_name == "podcast_pro":
            # Podcast Professional: modern typography, bold lower-third with speaker distinction
            styles = "Style: Default,Trebuchet MS,64,&HFFFFFF&,&H000000&,&H151515&,&H90000000&,1,0,0,0,100,100,0,0,1,5,3,2,100,100,420,1\n"
            active_color = "\\c&H4AE8A0&" # Mint green
            normal_color = "\\c&HFFFFFF&"
        else: # bold_viral (default)
            # Bold Viral: vibrant yellow highlight, thick dark outline, high-impact uppercase
            styles = "Style: Default,Impact,72,&HFFFFFF&,&H000000&,&H000000&,&HA0000000&,1,0,0,0,100,100,1,0,1,7,4,2,80,80,450,1\n"
            active_color = "\\c&H00FFFF&" # Bright Yellow highlight
            normal_color = "\\c&HFFFFFF&"

        dialogue_lines: List[str] = []

        # Generate dialogue events with word highlighting
        for phrase in phrases:
            phrase_start = phrase[0]["start"]
            phrase_end = phrase[-1]["end"]
            
            # For each word in the phrase, render a sub-dialogue line where that word is highlighted
            for i, target_word in enumerate(phrase):
                sub_start = target_word["start"]
                sub_end = target_word["end"]
                
                # Format text with the target word highlighted
                text_parts = []
                for j, w in enumerate(phrase):
                    display_word = w["word"].upper() if style_name == "bold_viral" else w["word"]
                    if i == j:
                        # Highlighted word with slight pop
                        text_parts.append(f"{{{active_color}\\fscx108\\fscy108}}{display_word}{{{normal_color}\\fscx100\\fscy100}}")
                    else:
                        text_parts.append(f"{{{normal_color}}}{display_word}")
                
                formatted_text = " ".join(text_parts)
                start_str = cls._format_timestamp(sub_start)
                end_str = cls._format_timestamp(sub_end)
                dialogue_lines.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{formatted_text}")

        content = header + styles + "\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n" + "\n".join(dialogue_lines) + "\n"
        output_path.write_text(content, encoding="utf-8")
        return output_path
