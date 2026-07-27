#!/usr/bin/env python3
"""Local-first server for the Daily English learning dashboard."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "app" / "public"
SEED_FILE = ROOT / "app" / "data" / "seed_state.json"
STATE_FILE = ROOT / ".learning" / "state.json"


def load_state() -> dict:
    source = STATE_FILE if STATE_FILE.exists() else SEED_FILE
    return json.loads(source.read_text(encoding="utf-8"))


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
        if urlparse(self.path).path != "/api/action":
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
            self.send_error(HTTPStatus.BAD_REQUEST, "Unknown action")
            return

        state = load_state()
        lesson = state["today"]
        previous_status = lesson.get("status", "ready")

        if action == "reset":
            lesson["status"] = "ready"
            lesson.pop("difficulty_note", None)
        elif action == "complete":
            lesson["status"] = "completed"
            if previous_status != "completed":
                state["profile"]["streak"] = state["profile"].get("streak", 0) + 1
        elif action == "hard":
            lesson["status"] = "needs_review"
            lesson["difficulty_note"] = "Bring this back with slower audio and a shorter speaking task."
        else:
            lesson["status"] = "skipped"

        state.setdefault("activity", []).insert(
            0,
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "lesson_id": lesson["id"],
                "action": action,
            },
        )
        save_state(state)
        self.send_json(state)

    def send_json(self, data: dict) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
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
