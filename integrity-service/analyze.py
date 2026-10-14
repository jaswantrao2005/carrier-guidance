#!/usr/bin/env python
"""
Command-line face-presence analysis for a single interview recording.

    python analyze.py path/to/recording.webm
    python analyze.py rec.webm --json
    python analyze.py rec.webm --sample-fps 4 --min-absence 5

Exit codes are deliberately NOT used to signal "cheating" -- 0 means the analysis
ran, 1 means it could not. Nothing here decides anything about a candidate.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.detector import Config, FacePresenceAnalyzer


def _ts(ms: int) -> str:
    s, m = (ms // 1000) % 60, ms // 60000
    return f"{m}:{s:02d}"


def main() -> int:
    ap = argparse.ArgumentParser(description="Analyse face presence in an interview recording.")
    ap.add_argument("video", type=Path)
    ap.add_argument("--json", action="store_true", help="Emit JSON instead of a report")
    ap.add_argument("--sample-fps", type=float, default=2.0)
    ap.add_argument("--min-absence", type=float, default=10.0, metavar="SEC")
    ap.add_argument("--min-multi-face", type=float, default=5.0, metavar="SEC")
    args = ap.parse_args()

    if not args.video.exists():
        print(f"error: no such file: {args.video}", file=sys.stderr)
        return 1

    cfg = Config(
        sample_fps=args.sample_fps,
        min_absence_ms=int(args.min_absence * 1000),
        min_multi_face_ms=int(args.min_multi_face * 1000),
    )

    try:
        result = FacePresenceAnalyzer(config=cfg).analyze(args.video)
    except (ValueError, FileNotFoundError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
        return 0

    q = result.quality
    print(f"\n  Recording : {args.video.name}")
    print(f"  Duration  : {_ts(result.duration_ms)}")
    if q:
        print(f"  Frames    : {q.frames_analysed} @ {q.fps_sampled}fps  "
              f"({q.resolution[0]}x{q.resolution[1]})")
        print(f"  Detection : {q.detection_rate:.0%} of frames, "
              f"stability {q.stability:.0%}, mean confidence {q.mean_confidence:.2f}")

    if q and not q.reliable:
        print("\n  ⚠ RECORDING QUALITY TOO LOW FOR ANALYSIS")
        print(f"    {q.reason}")
        print("    No behavioural signals are reported. This is a video problem,")
        print("    not a statement about the candidate.\n")
        return 0

    if not result.signals:
        print("\n  No reviewable events.\n")
        return 0

    print(f"\n  {len(result.signals)} event(s) for human review:\n")
    for s in result.signals:
        print(f"    [{_ts(s.start_ms)}–{_ts(s.end_ms)}] {s.type}  "
              f"(confidence {s.confidence:.2f})")
        print(f"      {s.description}")
    print("\n  These are observations, not conclusions. A person must review the")
    print("  recording before drawing any inference.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
