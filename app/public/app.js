const stateUrl = "/api/state";

function render(state) {
  const lesson = state.today;
  document.querySelector("#lesson-date").textContent = lesson.date;
  document.querySelector("#today-title").innerHTML = lesson.theme.replace(" ", "<br />");
  document.querySelector(".lesson-intro h2").innerHTML = lesson.theme.replace(" ", "<br />");
  document.querySelector(".lede").textContent = "A real voice, one small response, and a way to carry the language into your next conversation.";
  document.querySelector("#source-name").textContent = lesson.source;
  document.querySelector("#source-duration").textContent = lesson.duration;
  document.querySelector("#source-accent").textContent = lesson.accent;
  document.querySelector("#source-link").href = lesson.source_url;
  document.querySelector("#listen-task").textContent = lesson.listen_task;
  document.querySelector("#speaking-task").textContent = lesson.speaking_task;
  document.querySelector("#streak-value").textContent = state.profile.streak;
  document.querySelector("#review-count").textContent = String(state.review.length).padStart(2, "0");

  const phrases = document.querySelector("#phrase-list");
  phrases.innerHTML = lesson.phrases.map((item, index) => `
    <div class="phrase-row"><span class="phrase-index">0${index + 1}</span><span class="phrase-text">${item.phrase}</span><span class="phrase-note">${item.note}</span></div>`).join("");

  const review = document.querySelector("#review-list");
  review.innerHTML = state.review.map((item) => `
    <div class="review-item"><time>${item.due}</time><div><strong>${item.phrase}</strong><span>${item.context}</span></div></div>`).join("");

  const week = document.querySelector("#week-strip");
  week.innerHTML = state.week.map((item) => `
    <div class="day-cell ${item.state}"><b>${item.day}</b><span>${item.label}</span></div>`).join("");

  const copy = document.querySelector("#status-copy");
  if (lesson.status === "completed") copy.textContent = "Logged. Tomorrow will build on this without repeating the material.";
  if (lesson.status === "needs_review") copy.textContent = "Noted. This will return in a slower, smaller form.";
  if (lesson.status === "skipped") copy.textContent = "Skipped without guilt. The next lesson stays short and useful.";
}

async function load() {
  const response = await fetch(stateUrl);
  render(await response.json());
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    const response = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: button.dataset.action })
    });
    if (response.ok) render(await response.json());
  });
});

load();
