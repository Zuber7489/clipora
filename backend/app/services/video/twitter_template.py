import os
from pathlib import Path
from typing import Tuple, Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont
import logging

logger = logging.getLogger(__name__)

class TwitterTemplateService:
    """
    Generates high-retention Twitter / X post style video overlays.
    Draws a dark-mode enterprise post card with avatar, display name, verified checkmark,
    viral hook text, engagement metrics, and a transparent cutout for the video player.
    """

    @classmethod
    def _get_font(cls, bold: bool = False, size: int = 32) -> ImageFont.ImageFont:
        font_dir = os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts")
        font_name = "segoeuib.ttf" if bold else "segoeui.ttf"
        font_path = os.path.join(font_dir, font_name)
        if not os.path.exists(font_path):
            font_path = os.path.join(font_dir, "arialbd.ttf" if bold else "arial.ttf")

        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            return ImageFont.load_default()

    @classmethod
    def generate_overlay(
        cls,
        clip_title: str,
        author_name: str = "Stream Highlights",
        author_handle: str = "clipora_live",
        output_path: Optional[Path] = None
    ) -> Tuple[Path, Dict[str, int]]:
        """
        Creates a 1080x1920 overlay PNG.
        Returns (output_path, {"x": vid_x, "y": vid_y, "w": vid_w, "h": vid_h}).
        """
        if output_path is None:
            output_path = Path("c:/zuberprojects/clipora/backend/storage/temp/tweet_overlay.png")
        output_path.parent.mkdir(parents=True, exist_ok=True)

        w, h = 1080, 1920
        img = Image.new("RGBA", (w, h), (9, 9, 11, 255)) # Dark neutral canvas
        draw = ImageDraw.Draw(img)

        # Card Box boundaries
        card_x = 44
        card_y = 180
        card_w = 992
        card_h = 1540
        draw.rounded_rectangle(
            [card_x, card_y, card_x + card_w, card_y + card_h],
            radius=28,
            fill=(14, 14, 18, 255),
            outline=(39, 39, 42, 255),
            width=2
        )

        # 1. Author Avatar
        av_x = card_x + 32
        av_y = card_y + 36
        av_r = 44
        draw.ellipse([av_x, av_y, av_x + av_r * 2, av_y + av_r * 2], fill=(37, 99, 235, 255))

        # Avatar Initials
        initials = "".join(part[0].upper() for part in author_name.split()[:2]) or "CL"
        f_av = cls._get_font(bold=True, size=36)
        draw.text((av_x + 22, av_y + 20), initials, font=f_av, fill=(255, 255, 255, 255))

        # 2. Display Name
        f_name = cls._get_font(bold=True, size=34)
        name_x = av_x + av_r * 2 + 20
        name_y = av_y + 8
        draw.text((name_x, name_y), author_name, font=f_name, fill=(255, 255, 255, 255))

        # 3. Verified Badge
        name_width = int(draw.textlength(author_name, font=f_name))
        bx = name_x + name_width + 12
        by = name_y + 8
        draw.ellipse([bx, by, bx + 26, by + 26], fill=(29, 155, 240, 255))
        draw.polygon(
            [(bx + 7, by + 13), (bx + 11, by + 18), (bx + 19, by + 9), (bx + 18, by + 7), (bx + 11, by + 15), (bx + 8, by + 11)],
            fill=(255, 255, 255, 255)
        )

        # 4. Handle and Timestamp
        f_handle = cls._get_font(bold=False, size=26)
        clean_handle = author_handle if author_handle.startswith("@") else f"@{author_handle}"
        draw.text((name_x, name_y + 44), f"{clean_handle} · 2h", font=f_handle, fill=(113, 113, 122, 255))

        # 5. X Logo in top right
        f_xlogo = cls._get_font(bold=True, size=34)
        draw.text((card_x + card_w - 60, av_y + 10), "𝕏", font=f_xlogo, fill=(113, 113, 122, 255))

        # 6. Viral Hook Text (with word wrap)
        f_text = cls._get_font(bold=True, size=40)
        hook_y = av_y + av_r * 2 + 28
        words = clip_title.split()
        lines = []
        cur_line = []
        max_line_w = card_w - 70

        for word in words:
            test_line = " ".join(cur_line + [word])
            if draw.textlength(test_line, font=f_text) < max_line_w:
                cur_line.append(word)
            else:
                if cur_line:
                    lines.append(" ".join(cur_line))
                cur_line = [word]
        if cur_line:
            lines.append(" ".join(cur_line))

        # Draw lines of tweet text
        line_height = 52
        for line in lines[:3]: # Cap at 3 lines
            draw.text((card_x + 32, hook_y), line, font=f_text, fill=(244, 244, 245, 255))
            hook_y += line_height

        # 7. Video Cutout Box
        # Position right below the hook text with sleek rounded border
        vid_x = card_x + 28
        vid_y = hook_y + 24
        vid_w = card_w - 56  # 936px width
        vid_h = 780          # Crisp 16:9 / 4:3 fit

        # Clear transparent rectangle for the video to play through
        draw.rounded_rectangle(
            [vid_x, vid_y, vid_x + vid_w, vid_y + vid_h],
            radius=20,
            fill=(0, 0, 0, 0),
            outline=(45, 45, 52, 255),
            width=2
        )

        # 8. Post Engagement Metrics Bar
        stats_y = vid_y + vid_h + 36
        draw.line([card_x + 32, stats_y, card_x + card_w - 32, stats_y], fill=(39, 39, 42, 255), width=1)

        f_stats = cls._get_font(bold=False, size=24)
        stats_text_y = stats_y + 24
        
        # Draw metric icons & counts
        draw.text((card_x + 50, stats_text_y), "💬 1.4K", font=f_stats, fill=(113, 113, 122, 255))
        draw.text((card_x + 240, stats_text_y), "🔁 8.9K", font=f_stats, fill=(113, 113, 122, 255))
        draw.text((card_x + 440, stats_text_y), "❤️ 48.2K", font=f_stats, fill=(239, 68, 68, 255))
        draw.text((card_x + 650, stats_text_y), "📊 1.8M", font=f_stats, fill=(113, 113, 122, 255))
        draw.text((card_x + 850, stats_text_y), "🔖 12K", font=f_stats, fill=(113, 113, 122, 255))

        # Save to PNG
        img.save(str(output_path), "PNG")
        logger.info(f"✅ Generated Twitter/X template overlay at {output_path}")

        return output_path, {
            "x": vid_x,
            "y": vid_y,
            "w": vid_w,
            "h": vid_h
        }
