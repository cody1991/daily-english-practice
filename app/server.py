#!/usr/bin/env python3
"""Local-first server for the Daily English learning dashboard."""

from __future__ import annotations

import json
import subprocess
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


def apply_action(state: dict, action: str) -> dict:
    lesson = state["today"]
    previous_status = lesson.get("status", "ready")
    profile = state.setdefault("profile", {})
    completed_dates = set(profile.get("completed_dates", []))
    lesson_date = lesson_day(lesson).isoformat()

    if action == "reset":
        lesson["status"] = "ready"
        lesson.pop("difficulty_note", None)
        completed_dates.discard(lesson_date)
    elif previous_status != "ready":
        raise ValueError("Today is already logged. Use Edit today before changing it.")
    elif action == "complete":
        lesson["status"] = "completed"
        completed_dates.add(lesson_date)
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
            self.send_json(load_state())
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/sync":
            self.send_json({"state": load_state(), "sync": sync_state()})
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
        self.send_json(state)

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
