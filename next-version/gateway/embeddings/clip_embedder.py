"""CLIP Embedder — image and text embeddings via openai/clip-vit-base-patch32.

Absorbed from 7_farm_visit/server/rag_service/embeddings/clip_embedder.py.
Supports GPU acceleration with CPU fallback.
"""
from __future__ import annotations

import base64
import io
import os
from pathlib import Path
from typing import List, Optional

# Lazy-loading globals
_clip_model = None
_clip_processor = None
_device: str | None = None


def _get_device() -> str:
    global _device
    if _device is not None:
        return _device
    try:
        import torch
        if torch.cuda.is_available():
            _device = "cuda"
            print(f"[CLIP] Using GPU: {torch.cuda.get_device_name(0)}")
        else:
            _device = "cpu"
            print("[CLIP] CUDA not available, using CPU")
    except ImportError:
        _device = "cpu"
        print("[CLIP] PyTorch not installed, using CPU")
    return _device


def _load_clip_model():
    global _clip_model, _clip_processor
    if _clip_model is not None:
        return _clip_model, _clip_processor
    try:
        from transformers import CLIPModel, CLIPProcessor
        device = _get_device()
        model_name = "openai/clip-vit-base-patch32"
        print(f"[CLIP] Loading model: {model_name} ...")
        _clip_processor = CLIPProcessor.from_pretrained(model_name)
        _clip_model = CLIPModel.from_pretrained(model_name)
        _clip_model = _clip_model.to(device)
        _clip_model.eval()
        print(f"[CLIP] Model loaded on {device}")
        return _clip_model, _clip_processor
    except ImportError as exc:
        print(f"[CLIP] transformers not available: {exc}")
        return None, None
    except Exception as exc:
        print(f"[CLIP] Failed to load model: {exc}")
        return None, None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_image_embedding(image_input, return_numpy: bool = True) -> Optional[List[float]]:
    """Generate a 512-d CLIP embedding for an image (path, bytes, PIL, or base64)."""
    try:
        from PIL import Image
        import torch

        model, processor = _load_clip_model()
        if model is None:
            return None
        device = _get_device()

        if isinstance(image_input, str):
            if image_input.startswith("data:image"):
                image_input = base64.b64decode(image_input.split(",")[1])
                image = Image.open(io.BytesIO(image_input))
            elif image_input.startswith("/9j/") or len(image_input) > 1000:
                image = Image.open(io.BytesIO(base64.b64decode(image_input)))
            else:
                image = Image.open(image_input)
        elif isinstance(image_input, bytes):
            image = Image.open(io.BytesIO(image_input))
        else:
            image = image_input

        if image.mode != "RGB":
            image = image.convert("RGB")

        inputs = processor(images=image, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            feats = model.get_image_features(**inputs)
            feats = feats / feats.norm(dim=-1, keepdim=True)
        return feats.cpu().numpy().flatten().tolist()
    except Exception as exc:
        print(f"[CLIP] Image embedding error: {exc}")
        return None


def get_text_embedding_clip(text: str) -> Optional[List[float]]:
    """Generate a 512-d CLIP text embedding (for cross-modal search)."""
    if not text or not text.strip():
        return None
    try:
        import torch
        model, processor = _load_clip_model()
        if model is None:
            return None
        device = _get_device()

        inputs = processor(text=text, return_tensors="pt", padding=True, truncation=True)
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            feats = model.get_text_features(**inputs)
            feats = feats / feats.norm(dim=-1, keepdim=True)
        return feats.cpu().numpy().flatten().tolist()
    except Exception as exc:
        print(f"[CLIP] Text embedding error: {exc}")
        return None


def get_image_metadata(image_path: str) -> dict:
    """Extract width, height, format, and EXIF GPS from an image file."""
    meta: dict = {
        "width": None, "height": None, "format": None,
        "exif_lat": None, "exif_lon": None, "exif_timestamp": None,
    }
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS, GPSTAGS

        with Image.open(image_path) as img:
            meta["width"] = img.width
            meta["height"] = img.height
            meta["format"] = img.format

            exif = img._getexif()
            if exif:
                for tid, val in exif.items():
                    tag = TAGS.get(tid, tid)
                    if tag == "GPSInfo":
                        gps = {GPSTAGS.get(k, k): v for k, v in val.items()}
                        if "GPSLatitude" in gps and "GPSLongitude" in gps:
                            meta["exif_lat"] = _gps_decimal(
                                gps["GPSLatitude"], gps.get("GPSLatitudeRef", "N"))
                            meta["exif_lon"] = _gps_decimal(
                                gps["GPSLongitude"], gps.get("GPSLongitudeRef", "E"))
                    elif tag == "DateTimeOriginal":
                        try:
                            from datetime import datetime as _dt
                            dt = _dt.strptime(str(val), "%Y:%m:%d %H:%M:%S")
                            meta["exif_timestamp"] = int(dt.timestamp() * 1000)
                        except Exception:
                            pass
    except Exception as exc:
        print(f"[CLIP] Metadata error: {exc}")
    return meta


def check_clip_availability() -> dict:
    result = {"available": False, "device": None, "model_name": None, "error": None}
    try:
        model, _ = _load_clip_model()
        if model is not None:
            result["available"] = True
            result["device"] = _get_device()
            result["model_name"] = "openai/clip-vit-base-patch32"
        else:
            result["error"] = "Failed to load CLIP model"
    except Exception as exc:
        result["error"] = str(exc)
    return result


def _gps_decimal(coords, ref) -> float | None:
    try:
        d = float(coords[0]) + float(coords[1]) / 60 + float(coords[2]) / 3600
        return round(-d if ref in ("S", "W") else d, 6)
    except Exception:
        return None
