from pathlib import Path
import pytest
from backend.app.services.subtitles.presets import (
    get_preset,
    resolve_preset_name,
    PRESETS,
    STYLE_ALIASES
)
from backend.app.services.subtitles.generator import SubtitleGenerator

def test_preset_registry_resolution():
    assert resolve_preset_name("alex_hormozi") == "alex_hormozi"
    assert resolve_preset_name("mrbeast_bouncy") == "mrbeast_bouncy"
    assert resolve_preset_name("abdaal_minimal") == "abdaal_minimal"
    assert resolve_preset_name("neon_cyber") == "neon_cyber"
    # Legacy aliases
    assert resolve_preset_name("bold_viral") == "mrbeast_bouncy"
    assert resolve_preset_name("clean_minimal") == "abdaal_minimal"
    assert resolve_preset_name("hormozi_hyper") == "alex_hormozi"
    assert resolve_preset_name("podcast_pro") == "abdaal_minimal"
    assert resolve_preset_name("unknown_preset") == "alex_hormozi"

def test_preset_style_generation(tmp_path):
    words = [
        {"word": "Make", "start": 0.2, "end": 0.6},
        {"word": "viral", "start": 0.6, "end": 1.0},
        {"word": "money", "start": 1.0, "end": 1.5},
    ]
    for preset_name in ["alex_hormozi", "mrbeast_bouncy", "abdaal_minimal", "neon_cyber"]:
        sub_path = tmp_path / f"{preset_name}.ass"
        SubtitleGenerator.generate_ass(words, sub_path, style_name=preset_name, clip_start=0.0, clip_end=3.0)
        assert sub_path.exists()
        content = sub_path.read_text(encoding="utf-8")
        assert "[Script Info]" in content
        assert "[V4+ Styles]" in content
        assert "[Events]" in content
        assert "\\kf" in content

def test_custom_user_edited_words_rerender(tmp_path):
    custom_words = [
        {"word": "Custom", "start": 0.5, "end": 1.0},
        {"word": "Title", "start": 1.0, "end": 1.8},
        {"word": "Edited", "start": 1.8, "end": 2.5},
    ]
    sub_path = tmp_path / "custom.ass"
    SubtitleGenerator.generate_ass(custom_words, sub_path, style_name="mrbeast_bouncy", clip_start=0.0, clip_end=4.0)
    assert sub_path.exists()
    content = sub_path.read_text(encoding="utf-8")
    assert "CUSTOM" in content
    assert "EDITED" in content
    assert "\\fscx125" in content  # Bouncy animation tag verified
