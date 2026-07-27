#!/usr/bin/env python3
"""Publish one curated English lesson into the local dashboard state."""

from __future__ import annotations

import argparse
import json
import re
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path


REQUIRED_FIELDS = {
    "id", "date", "theme", "source", "source_type", "source_url", "duration", "segment",
    "accent", "listen_task", "speaking_task", "phrases",
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_lesson(lesson: dict) -> None:
    missing = REQUIRED_FIELDS - lesson.keys()
    if missing:
        raise ValueError(f"Lesson is missing fields: {', '.join(sorted(missing))}")
    if not isinstance(lesson["phrases"], list) or not 2 <= len(lesson["phrases"]) <= 3:
        raise ValueError("Lesson must include 2-3 reusable phrases.")
    if not lesson["source_url"].startswith(("https://", "http://")):
        raise ValueError("Lesson source_url must be an HTTP(S) URL.")
    if not re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?\s*[–-]\s*\d{1,2}:\d{2}(?::\d{2})?", lesson["segment"]):
        raise ValueError("Lesson segment must be an exact time range, for example '00:00–06:20'.")


def due_label(days: int) -> str:
    return (datetime.now() + timedelta(days=days)).strftime("%a, %d %b")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("lesson_json", type=Path)
    parser.add_argument("--project-root", type=Path, required=True)
    args = parser.parse_args()

    lesson = load_json(args.lesson_json)
    validate_lesson(lesson)
    root = args.project_root.resolve()
    state_file = root / ".learning" / "state.json"
    seed_file = root / "app" / "data" / "seed_state.json"
    state = load_json(state_file if state_file.exists() else seed_file)
    prior = deepcopy(state.get("today", {}))

    if prior.get("source_url") == lesson["source_url"]:
        raise ValueError("Refusing to publish the same source URL twice in a row.")

    review = state.get("review", [])
    for phrase in prior.get("phrases", []):
        if phrase["phrase"] not in {item["phrase"] for item in review}:
            review.append({
                "phrase": phrase["phrase"],
                "due": due_label(3),
                "context": phrase["note"],
            })

    state["today"] = {**lesson, "status": "ready"}
    state["review"] = review[:12]
    history = state.setdefault("history", [])
    if prior:
        history.insert(0, {
            "id": prior.get("id"),
            "source_url": prior.get("source_url"),
            "theme": prior.get("theme"),
            "source": prior.get("source"),
        })
    state["history"] = history[:90]

    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Published {lesson['id']} to {state_file}")


if __name__ == "__main__":
    main()
