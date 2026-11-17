"""
Preset definitions and styling configurations for viral subtitle rendering.
Supports Alex Hormozi (highlight box), MrBeast (bouncy pop), Ali Abdaal (clean minimal),
and Neon Cyber styles, with backward-compatibility aliases.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional

@dataclass
class SubtitlePreset:
    name: str
    font_name: str
    font_size: int
    primary_color: str      # ASS color &HAABBGGRR&
    secondary_color: str    # Fill / inactive color &HAABBGGRR&
    outline_color: str      # Outline color &HAABBGGRR&
    back_color: str         # Shadow / Box color &HAABBGGRR&
    bold: int = -1          # -1 is True, 0 is False in ASS
    italic: int = 0
    underline: int = 0
    strikeout: int = 0
    scale_x: int = 100
    scale_y: int = 100
    spacing: int = 0
    angle: int = 0
    border_style: int = 1   # 1 = outline + shadow, 3 = opaque box
    outline: int = 4
    shadow: int = 2
    alignment: int = 2      # 2 = Bottom center
    margin_l: int = 60
    margin_r: int = 60
    margin_v: int = 440     # Safe vertical margin for 9:16 reels
    encoding: int = 1
    uppercase: bool = True
    has_bounce: bool = False
    has_glow: bool = False
    blur: float = 0.0
    max_words_per_phrase: int = 3
    max_chars_per_phrase: int = 20

    def to_ass_style_line(self, style_name_override: Optional[str] = None) -> str:
        name = style_name_override or self.name
        return (
            f"Style: {name},{self.font_name},{self.font_size},"
            f"{self.primary_color},{self.secondary_color},{self.outline_color},{self.back_color},"
            f"{self.bold},{self.italic},{self.underline},{self.strikeout},"
            f"{self.scale_x},{self.scale_y},{self.spacing},{self.angle},"
            f"{self.border_style},{self.outline},{self.shadow},{self.alignment},"
            f"{self.margin_l},{self.margin_r},{self.margin_v},{self.encoding}"
        )

PRESETS: Dict[str, SubtitlePreset] = {
    "alex_hormozi": SubtitlePreset(
        name="alex_hormozi",
        font_name="Segoe UI Black",
        font_size=68,
        primary_color="&H0055FF00&",     # Neon Lime Green
        secondary_color="&H00FFFFFF&",   # Crisp White
        outline_color="&H00000000&",     # Pure Black
        back_color="&HC0000000&",       # Semi-transparent Shadow
        bold=-1,
        border_style=1,
        outline=8,
        shadow=3,
        alignment=2,
        margin_v=440,
        spacing=1,
        uppercase=True,
        max_words_per_phrase=3,
        max_chars_per_phrase=18
    ),
    "mrbeast_bouncy": SubtitlePreset(
        name="mrbeast_bouncy",
        font_name="Impact",
        font_size=76,
        primary_color="&H0000FFFF&",     # Vibrant Yellow
        secondary_color="&H00FFFFFF&",   # Crisp White
        outline_color="&H00000000&",     # Pure Black
        back_color="&H80000000&",       # Shadow
        bold=-1,
        border_style=1,
        outline=10,
        shadow=4,
        alignment=2,
        margin_v=440,
        spacing=1,
        uppercase=True,
        has_bounce=True,
        max_words_per_phrase=3,
        max_chars_per_phrase=18
    ),
    "abdaal_minimal": SubtitlePreset(
        name="abdaal_minimal",
        font_name="Segoe UI",
        font_size=54,
        primary_color="&H0000D7FF&",     # Warm Gold
        secondary_color="&H00E0E0E0&",   # Soft White
        outline_color="&H00000000&",     # Pure Black
        back_color="&H60000000&",       # Subtle Shadow
        bold=1,
        border_style=1,
        outline=3,
        shadow=1,
        alignment=2,
        margin_l=80,
        margin_r=80,
        margin_v=440,
        spacing=0,
        uppercase=False,
        max_words_per_phrase=4,
        max_chars_per_phrase=24
    ),
    "neon_cyber": SubtitlePreset(
        name="neon_cyber",
        font_name="Segoe UI Black",
        font_size=68,
        primary_color="&H00FFFF00&",     # Electric Cyan
        secondary_color="&H00EAD0FF&",   # Soft Lavender
        outline_color="&H00D000D0&",     # Vivid Magenta Outline
        back_color="&H80FF0080&",       # Magenta Glow Shadow
        bold=-1,
        border_style=1,
        outline=7,
        shadow=2,
        alignment=2,
        margin_v=440,
        spacing=2,
        uppercase=True,
        has_glow=True,
        blur=4.0,
        max_words_per_phrase=3,
        max_chars_per_phrase=18
    ),
}

STYLE_ALIASES: Dict[str, str] = {
    "bold_viral": "mrbeast_bouncy",
    "clean_minimal": "abdaal_minimal",
    "hormozi_hyper": "alex_hormozi",
    "podcast_pro": "abdaal_minimal",
}

def resolve_preset_name(name: Optional[str]) -> str:
    cleaned = (name or "").strip().lower()
    if cleaned in STYLE_ALIASES:
        return STYLE_ALIASES[cleaned]
    if cleaned in PRESETS:
        return cleaned
    return "alex_hormozi"

def get_preset(name: Optional[str]) -> SubtitlePreset:
    canonical = resolve_preset_name(name)
    return PRESETS[canonical]
