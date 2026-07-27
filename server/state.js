import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateFile = path.join(root, ".learning", "state.json");
const seedFile = path.join(root, "data", "seed-state.json");
const syncScript = path.join(root, "scripts", "sync_state.sh");

const parseDay = (value) => new Date(`${value}T00:00:00`);
const formatIsoDay = (day) => [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-");
const addDays = (day, amount) => new Date(day.getFullYear(), day.getMonth(), day.getDate() + amount);

export async function loadState() {
  try {
    return JSON.parse(await readFile(stateFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return JSON.parse(await readFile(seedFile, "utf8"));
  }
}

export async function saveState(state) {
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function lessonDay(lesson) {
  return parseDay(lesson.id.slice(0, 10));
}

export function completionStreak(completedDates) {
  const completed = new Set(completedDates);
  if (completed.size === 0) return 0;

  let cursor = parseDay([...completed].sort().at(-1));
  let streak = 0;
  while (completed.has(formatIsoDay(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function reviewDueLabel(dueDate, today) {
  const difference = Math.round((parseDay(dueDate) - today) / 86_400_000);
  if (difference < 0) return "已逾期";
  if (difference === 0) return "今天";
  if (difference === 1) return "明天";
  return `${String(parseDay(dueDate).getMonth() + 1).padStart(2, "0")}/${String(parseDay(dueDate).getDate()).padStart(2, "0")}`;
}

function reviewForDisplay(review, today) {
  return review
    .filter((item) => item.due_date)
    .map((item) => ({ ...item, due_label: reviewDueLabel(item.due_date, today) }))
    .sort((left, right) => left.due_date.localeCompare(right.due_date));
}

function weekForDisplay(state, today) {
  const currentLesson = state.today;
  const weekStart = addDays(today, -(today.getDay() + 6) % 7);
  const lessons = new Map((state.history ?? []).map((lesson) => [lesson.id.slice(0, 10), lesson]));
  if (currentLesson) lessons.set(currentLesson.id.slice(0, 10), currentLesson);
  const actions = new Map((state.activity ?? []).map((item) => [item.lesson_id, item.action]));
  const actionState = { complete: "completed", hard: "needs_review", skip: "skipped" };

  return Array.from({ length: 5 }, (_, offset) => {
    const day = addDays(weekStart, offset);
    const lesson = lessons.get(formatIsoDay(day));
    if (!lesson) {
      return {
        day: day.toLocaleDateString("en-GB", { weekday: "short" }),
        date: day.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        label: day >= today ? "待生成" : "未生成",
        state: "empty"
      };
    }
    const status = lesson.status ?? actionState[actions.get(lesson.id)] ?? "planned";
    return {
      day: day.toLocaleDateString("en-GB", { weekday: "short" }),
      date: day.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      label: lesson.theme ?? "Lesson",
      state: formatIsoDay(day) === formatIsoDay(today) && status === "ready" ? "today" : status
    };
  });
}

export function stateForDisplay(state, currentDay = new Date()) {
  const today = state.today ? lessonDay(state.today) : new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
  return {
    ...structuredClone(state),
    current_date: today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
    review: reviewForDisplay(state.review ?? [], today),
    week: weekForDisplay(state, today)
  };
}

export function applyAction(state, action, now = new Date()) {
  if (!state.today) throw new Error("There is no lesson to log today.");
  const lesson = state.today;
  const previousStatus = lesson.status ?? "ready";
  const profile = state.profile ?? {};
  const completedDates = new Set(profile.completed_dates ?? []);
  const lessonDate = formatIsoDay(lessonDay(lesson));

  if (action === "reset") {
    lesson.status = "ready";
    delete lesson.difficulty_note;
    completedDates.delete(lessonDate);
    state.review = (state.review ?? []).filter((item) => item.source_lesson_id !== lesson.id);
  } else if (previousStatus !== "ready") {
    throw new Error("Today is already logged. Use Edit today before changing it.");
  } else if (action === "complete") {
    lesson.status = "completed";
    completedDates.add(lessonDate);
    const review = state.review ?? [];
    const existingPhrases = new Set(review.map((item) => item.phrase));
    const dueDate = formatIsoDay(addDays(lessonDay(lesson), 3));
    for (const phrase of lesson.phrases ?? []) {
      if (!existingPhrases.has(phrase.phrase)) {
        review.push({ phrase: phrase.phrase, due_date: dueDate, context: phrase.note, source_lesson_id: lesson.id });
      }
    }
    state.review = review;
  } else if (action === "hard") {
    lesson.status = "needs_review";
    lesson.difficulty_note = "Bring this back with slower audio and a shorter speaking task.";
  } else if (action === "skip") {
    lesson.status = "skipped";
  } else {
    throw new Error("Unknown action");
  }

  profile.completed_dates = [...completedDates].sort();
  profile.last_completed_date = profile.completed_dates.at(-1) ?? null;
  profile.streak = completionStreak(profile.completed_dates);
  state.profile = profile;
  state.activity = [{ at: now.toISOString(), lesson_id: lesson.id, action }, ...(state.activity ?? [])].slice(0, 200);
  return state;
}

export async function syncState() {
  try {
    const { stdout, stderr } = await execFileAsync("zsh", [syncScript], { cwd: root, timeout: 60_000 });
    return { ok: true, message: (stdout || stderr || "Sync finished.").trim() };
  } catch (error) {
    return { ok: false, message: (error.stdout || error.stderr || error.message).trim() };
  }
}
