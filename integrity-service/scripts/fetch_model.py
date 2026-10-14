#!/usr/bin/env python
"""Download the BlazeFace short-range model (Apache-2.0, ~224 KB)."""
import sys, urllib.request
from pathlib import Path

URL = ("https://storage.googleapis.com/mediapipe-models/face_detector/"
       "blaze_face_short_range/float16/1/blaze_face_short_range.tflite")
dest = Path(__file__).resolve().parent.parent / "models" / "blaze_face_short_range.tflite"
dest.parent.mkdir(parents=True, exist_ok=True)
if dest.exists():
    print(f"already present: {dest} ({dest.stat().st_size} bytes)")
    sys.exit(0)
print(f"downloading -> {dest}")
urllib.request.urlretrieve(URL, dest)
print(f"done: {dest.stat().st_size} bytes")
