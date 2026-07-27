import assert from "node:assert/strict";
import test from "node:test";
import { applyAction, completionStreak, stateForDisplay } from "../server/state.js";

function stateFor(day = "2026-07-27") {
  return {
    profile: { streak: 0, completed_dates: [], last_completed_date: null },
    today: { id: `${day}-lesson`, status: "ready", phrases: [{ phrase: "Could we clarify that?", note: "Ask for detail." }] },
    review: [],
    activity: []
  };
}

test("completion streak requires consecutive dates", () => {
  assert.equal(completionStreak(["2026-07-25", "2026-07-26", "2026-07-27"]), 3);
  assert.equal(completionStreak(["2026-07-25", "2026-07-27"]), 1);
});

test("completion creates a three-day review item", () => {
  const state = stateFor();
  state.profile.completed_dates = ["2026-07-25", "2026-07-26"];
  const result = applyAction(state, "complete", new Date("2026-07-27T09:00:00"));
  assert.equal(result.profile.streak, 3);
  assert.equal(result.review[0].due_date, "2026-07-30");
});

test("logged lesson needs reset before another action", () => {
  const state = applyAction(stateFor(), "complete");
  assert.throws(() => applyAction(state, "skip"), /already logged/);
  assert.equal(applyAction(state, "reset").review.length, 0);
});

test("empty state contains no example lesson", () => {
  const display = stateForDisplay({ profile: { streak: 0 }, review: [], activity: [] }, new Date("2026-07-27T09:00:00"));
  assert.equal(display.today, undefined);
  assert.equal(display.review.length, 0);
  assert.equal(display.week.length, 5);
});
