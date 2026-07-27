import copy
import unittest

from app.server import apply_action, completion_streak


def state_for(day="2026-07-27"):
    return {
        "profile": {"streak": 0, "completed_dates": [], "last_completed_date": None},
        "today": {
            "id": f"{day}-lesson",
            "status": "ready",
            "phrases": [{"phrase": "Could we clarify that?", "note": "Ask for detail."}],
        },
        "activity": [],
    }


class LearningStateTests(unittest.TestCase):
    def test_completion_streak_requires_consecutive_dates(self):
        self.assertEqual(completion_streak(["2026-07-25", "2026-07-26", "2026-07-27"]), 3)
        self.assertEqual(completion_streak(["2026-07-25", "2026-07-27"]), 1)

    def test_complete_records_day_and_updates_streak(self):
        state = state_for()
        state["profile"]["completed_dates"] = ["2026-07-25", "2026-07-26"]

        result = apply_action(state, "complete")

        self.assertEqual(result["today"]["status"], "completed")
        self.assertEqual(result["profile"]["streak"], 3)
        self.assertEqual(result["profile"]["last_completed_date"], "2026-07-27")
        self.assertEqual(result["review"][0]["due_date"], "2026-07-30")

    def test_logged_lesson_requires_reset_before_change(self):
        state = apply_action(state_for(), "complete")

        with self.assertRaisesRegex(ValueError, "already logged"):
            apply_action(copy.deepcopy(state), "skip")

        reset = apply_action(state, "reset")
        self.assertEqual(reset["today"]["status"], "ready")
        self.assertEqual(reset["profile"]["streak"], 0)
        self.assertEqual(reset["review"], [])


if __name__ == "__main__":
    unittest.main()
