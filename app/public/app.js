const stateUrl = "/api/state";

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function renderPhrases(phrases) {
  const container = document.querySelector("#phrase-list");
  container.replaceChildren(...phrases.map((item, index) => {
    const row = makeElement("div", "phrase-row");
    row.append(
      makeElement("span", "phrase-index", String(index + 1).padStart(2, "0")),
      makeElement("span", "phrase-text", item.phrase),
      makeElement("span", "phrase-note", item.note)
    );
    return row;
  }));
}

function renderReview(items) {
  const container = document.querySelector("#review-list");
  if (items.length === 0) {
    container.replaceChildren(makeElement("p", "review-empty", "完成一节课程后，有用的表达会在三天后回到这里。"));
    return;
  }
  container.replaceChildren(...items.map((item) => {
    const row = makeElement("div", "review-item");
    const copy = document.createElement("div");
    copy.append(makeElement("strong", "", item.phrase), makeElement("span", "", item.context));
    row.append(makeElement("time", "", item.due_label), copy);
    return row;
  }));
}

function renderWeek(items) {
  const container = document.querySelector("#week-strip");
  container.replaceChildren(...items.map((item) => {
    const state = ["today", "planned", "completed", "needs_review", "skipped", "empty"].includes(item.state) ? item.state : "empty";
    const cell = makeElement("div", `day-cell ${state}`);
    cell.append(makeElement("b", "", item.day), makeElement("time", "", item.date), makeElement("span", "", item.label));
    return cell;
  }));
}

function render(state) {
  const lesson = state.today;
  document.querySelector("#lesson-date").textContent = lesson?.date || state.current_date;
  document.querySelector("#route-label").textContent = lesson ? `Today’s route · ${state.profile.minutes} min` : "Today’s lesson";
  document.querySelector("#streak-value").textContent = state.profile.streak;
  document.querySelector("#review-count").textContent = String(state.review.length).padStart(2, "0");
  renderReview(state.review);
  renderWeek(state.week);

  const hasLesson = Boolean(lesson);
  document.querySelector("#today-title").textContent = hasLesson ? lesson.theme : "No lesson yet.";
  document.querySelector("#empty-copy").hidden = hasLesson;
  document.querySelector("#source-meta").hidden = !hasLesson;
  document.querySelector("#source-link").hidden = !hasLesson;
  document.querySelector("#practice-plan").hidden = !hasLesson;
  document.querySelector("#phrase-section").hidden = !hasLesson;
  if (!hasLesson) return;

  document.querySelector("#source-name").textContent = lesson.source;
  document.querySelector("#source-duration").textContent = `${lesson.duration} · ${lesson.segment}`;
  document.querySelector("#source-accent").textContent = lesson.accent;
  document.querySelector("#source-link").href = lesson.source_url;
  document.querySelector("#listen-task").textContent = lesson.listen_task;
  document.querySelector("#speaking-task").textContent = lesson.speaking_task;
  renderPhrases(lesson.phrases);

  const logged = lesson.status !== "ready";
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.disabled = logged && button.dataset.action !== "reset";
    button.hidden = button.dataset.action === "reset" ? !logged : false;
  });
  const statusCopy = {
    ready: "No perfect study session required. Just make contact with the language.",
    completed: "Logged. Tomorrow will build on this without repeating the material.",
    needs_review: "Noted. This will return in a slower, smaller form.",
    skipped: "Skipped without guilt. The next lesson stays short and useful."
  };
  document.querySelector("#status-copy").textContent = statusCopy[lesson.status] || statusCopy.ready;
}

async function request(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

async function load() {
  const response = await fetch(stateUrl);
  render(await response.json());
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      render(await request("/api/action", { action: button.dataset.action }));
    } catch (error) {
      document.querySelector("#sync-copy").textContent = error.message;
    }
  });
});

document.querySelector("[data-sync]").addEventListener("click", async () => {
  const copy = document.querySelector("#sync-copy");
  copy.textContent = "Syncing...";
  try {
    const result = await request("/api/sync", {});
    render(result.state);
    copy.textContent = result.sync.message;
  } catch (error) {
    copy.textContent = error.message;
  }
});

load();
