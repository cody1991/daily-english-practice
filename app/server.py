#!/usr/bin/env python3
"""Local-first server for the Daily English learning dashboard."""

from __future__ import annotations

import json
import subprocess
from copy import deepcopy
from datetime import date, datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "app" / "public"
SEED_FILE = ROOT / "app" / "data" / "seed_state.json"
STATE_FILE = ROOT / ".learning" / "state.json"
SYNC_SCRIPT = ROOT / "scripts" / "sync_state.sh"


def load_state() -> dict:
    source = STATE_FILE if STATE_FILE.exists() else SEED_FILE
    return json.loads(source.read_text(encoding="utf-8"))


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def lesson_day(lesson: dict) -> date:
    return date.fromisoformat(lesson["id"][:10])


def completion_streak(completed_dates: list[str]) -> int:
    completed = {date.fromisoformat(value) for value in completed_dates}
    if not completed:
        return 0

    current = max(completed)
    streak = 0
    while current in completed:
        streak += 1
        current = current.fromordinal(current.toordinal() - 1)
    return streak


def review_due_label(due_date: str, today: date) -> str:
    difference = (date.fromisoformat(due_date) - today).days
    if difference < 0:
        return "已逾期"
    if difference == 0:
        return "今天"
    if difference == 1:
        return "明天"
    return date.fromisoformat(due_date).strftime("%m/%d")


def review_for_display(review: list[dict], today: date) -> list[dict]:
    items = []
    for item in review:
        due_date = item.get("due_date")
        if due_date:
            items.append({**item, "due_label": review_due_label(due_date, today)})
    return sorted(items, key=lambda item: item["due_date"])


def week_for_display(state: dict, current_day: date) -> list[dict]:
    current_lesson = state.get("today")
    week_start = current_day.fromordinal(current_day.toordinal() - current_day.weekday())
    lessons = {item["id"][:10]: item for item in state.get("history", [])}
    if current_lesson:
        lessons[current_lesson["id"][:10]] = current_lesson
    action_by_lesson = {item["lesson_id"]: item["action"] for item in state.get("activity", [])}
    action_state = {"complete": "completed", "hard": "needs_review", "skip": "skipped"}
    week = []

    for offset in range(5):
        day = week_start.fromordinal(week_start.toordinal() + offset)
        lesson = lessons.get(day.isoformat())
        if lesson:
            status = lesson.get("status") or action_state.get(action_by_lesson.get(lesson["id"]), "planned")
            week.append({
                "day": day.strftime("%a"),
                "date": day.strftime("%d %b"),
                "label": lesson.get("theme", "Lesson"),
                "state": "today" if day == current_day and status == "ready" else status,
            })
        else:
            week.append({
                "day": day.strftime("%a"),
                "date": day.strftime("%d %b"),
                "label": "待生成" if day >= current_day else "未生成",
                "state": "empty",
            })
    return week


def state_for_display(state: dict) -> dict:
    displayed = deepcopy(state)
    today = lesson_day(displayed["today"]) if displayed.get("today") else date.today()
    displayed["current_date"] = today.strftime("%A, %-d %B")
    displayed["review"] = review_for_display(displayed.get("review", []), today)
    displayed["week"] = week_for_display(displayed, today)
    return displayed


def apply_action(state: dict, action: str) -> dict:
    if not state.get("today"):
        raise ValueError("There is no lesson to log today.")
    lesson = state["today"]
    previous_status = lesson.get("status", "ready")
    profile = state.setdefault("profile", {})
    completed_dates = set(profile.get("completed_dates", []))
    lesson_date = lesson_day(lesson).isoformat()

    if action == "reset":
        lesson["status"] = "ready"
        lesson.pop("difficulty_note", None)
        completed_dates.discard(lesson_date)
        state["review"] = [
            item for item in state.get("review", [])
            if item.get("source_lesson_id") != lesson["id"]
        ]
    elif previous_status != "ready":
        raise ValueError("Today is already logged. Use Edit today before changing it.")
    elif action == "complete":
        lesson["status"] = "completed"
        completed_dates.add(lesson_date)
        review = state.setdefault("review", [])
        existing_phrases = {item["phrase"] for item in review}
        due_date = lesson_day(lesson).fromordinal(lesson_day(lesson).toordinal() + 3).isoformat()
        for phrase in lesson.get("phrases", []):
            if phrase["phrase"] not in existing_phrases:
                review.append({
                    "phrase": phrase["phrase"],
                    "due_date": due_date,
                    "context": phrase["note"],
                    "source_lesson_id": lesson["id"],
                })
    elif action == "hard":
        lesson["status"] = "needs_review"
        lesson["difficulty_note"] = "Bring this back with slower audio and a shorter speaking task."
    elif action == "skip":
        lesson["status"] = "skipped"
    else:
        raise ValueError("Unknown action")

    profile["completed_dates"] = sorted(completed_dates)
    profile["last_completed_date"] = max(completed_dates) if completed_dates else None
    profile["streak"] = completion_streak(profile["completed_dates"])
    state.setdefault("activity", []).insert(
        0,
        {
            "at": datetime.now(timezone.utc).isoformat(),
            "lesson_id": lesson["id"],
            "action": action,
        },
    )
    state["activity"] = state["activity"][:200]
    return state


def sync_state() -> dict:
    result = subprocess.run(
        ["zsh", str(SYNC_SCRIPT)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=60,
        check=False,
    )
    message = (result.stdout or result.stderr).strip()
    return {"ok": result.returncode == 0, "message": message or "Sync finished."}


class LearningHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        if urlparse(self.path).path == "/api/state":
            self.send_json(state_for_display(load_state()))
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/sync":
            self.send_json({"state": state_for_display(load_state()), "sync": sync_state()})
            return
        if path != "/api/action":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
            action = payload["action"]
        except (KeyError, ValueError, json.JSONDecodeError):
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid action payload")
            return

        if action not in {"complete", "hard", "skip", "reset"}:
            self.send_json({"error": "Unknown action"}, HTTPStatus.BAD_REQUEST)
            return

        state = load_state()
        try:
            state = apply_action(state, action)
        except ValueError as error:
            self.send_json({"error": str(error)}, HTTPStatus.CONFLICT)
            return
        save_state(state)
        self.send_json(state_for_display(state))

    def send_json(self, data: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 4173), LearningHandler)
    print("Daily English is running at http://127.0.0.1:4173")
    server.serve_forever()


if __name__ == "__main__":
    main()
