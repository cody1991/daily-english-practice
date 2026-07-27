import { useEffect, useState } from "react";

const API = "/api";
const actionCopy = {
  ready: "No perfect study session required. Just make contact with the language.",
  completed: "Logged. Tomorrow will build on this without repeating the material.",
  needs_review: "Noted. This will return in a slower, smaller form.",
  skipped: "Skipped without guilt. The next lesson stays short and useful."
};

async function request(path, payload) {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

function Review({ items }) {
  return (
    <section className="review-section" id="review">
      <span className="eyebrow">Review / 复习</span>
      <h2>学过一次，<br />再用一次。</h2>
      <div className="review-list">
        {items.length === 0 ? <p className="review-empty">完成一节课程后，有用的表达会在三天后回到这里。</p> : items.map((item) => (
          <div className="review-item" key={`${item.source_lesson_id}-${item.phrase}`}>
            <time>{item.due_label}</time>
            <div><strong>{item.phrase}</strong><span>{item.context}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Week({ items }) {
  return (
    <section className="week-section" id="week">
      <span className="eyebrow">This week / 本周</span>
      <div className="week-strip">
        {items.map((item) => (
          <div className={`day-cell ${item.state}`} key={item.date}>
            <b>{item.day}</b><time>{item.date}</time><span>{item.label}</span>
          </div>
        ))}
      </div>
      <p>每天生成的课程会显示在这里。</p>
    </section>
  );
}

function PracticePlan({ lesson, onAction, onSync, pending, syncMessage }) {
  const logged = lesson.status !== "ready";
  return (
    <>
      <section className="practice-grid" aria-label="Today’s practice plan">
        <article><span className="step">01 / listen</span><p>{lesson.listen_task}</p></article>
        <article><span className="step">02 / say</span><p>{lesson.speaking_task}</p></article>
        <article className="status-panel">
          <span className="step">03 / log it</span>
          <p>{actionCopy[lesson.status] ?? actionCopy.ready}</p>
          <div className="action-row">
            {logged ? (
              <button onClick={() => onAction("reset")} disabled={pending}>Edit today</button>
            ) : <>
              <button className="primary" onClick={() => onAction("complete")} disabled={pending}>Done</button>
              <button onClick={() => onAction("hard")} disabled={pending}>Too hard</button>
              <button onClick={() => onAction("skip")} disabled={pending}>Skip today</button>
            </>}
          </div>
          <div className="sync-row"><button onClick={onSync} disabled={pending}>Sync GitHub</button><span aria-live="polite">{syncMessage}</span></div>
        </article>
      </section>
      <section className="phrase-section" aria-labelledby="phrase-title">
        <div className="section-heading"><span className="eyebrow">Keep these</span><h2 id="phrase-title">Three lines worth carrying.</h2></div>
        <div className="phrase-list">
          {lesson.phrases.map((item, index) => (
            <div className="phrase-row" key={item.phrase}>
              <span className="phrase-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="phrase-text">{item.phrase}</span>
              <span className="phrase-note">{item.note}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export default function App() {
  const [state, setState] = useState(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API}/state`).then((response) => response.json()).then(setState).catch(() => setMessage("Could not load the local learning state."));
  }, []);

  async function updateAction(action) {
    setPending(true);
    setMessage("");
    try {
      setState(await request("/action", { action }));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPending(false);
    }
  }

  async function sync() {
    setPending(true);
    setMessage("Syncing...");
    try {
      const result = await request("/sync", {});
      setState(result.state);
      setMessage(result.sync.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPending(false);
    }
  }

  if (!state) return <main className="loading-state">Loading your learning state...</main>;
  const lesson = state.today;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="wordmark" href="#today">daily<br /><em>english</em></a>
        <nav aria-label="Primary navigation">
          <a className="active" href="#today">Today</a>
          <a href="#review">Review <span>{String(state.review.length).padStart(2, "0")}</span></a>
          <a href="#week">This week</a>
        </nav>
      </aside>

      <main>
        <header className="masthead">
          <div><span className="eyebrow">{lesson?.date ?? state.current_date}</span><h1>Daily <em>English.</em></h1></div>
          <div className="streak" aria-label="Current learning streak"><strong>{state.profile.streak}</strong><span>day<br />streak</span></div>
        </header>

        <section className="today-layout" id="today" aria-labelledby="today-title">
          <div className="lesson-intro">
            <span className="eyebrow">{lesson ? `Today’s route · ${state.profile.minutes} min` : "Today’s lesson"}</span>
            <h2 id="today-title">{lesson?.theme ?? "No lesson yet."}</h2>
            {lesson ? <>
              <div className="meta-line"><span>{lesson.source}</span><span>·</span><span>{lesson.duration} · {lesson.segment}</span><span>·</span><span>{lesson.accent}</span></div>
              <a className="source-link" href={lesson.source_url} target="_blank" rel="noreferrer">Open the source <span>↗</span></a>
            </> : <p className="empty-copy">A new lesson will appear here when it is generated.</p>}
          </div>
        </section>

        {lesson && <PracticePlan lesson={lesson} onAction={updateAction} onSync={sync} pending={pending} syncMessage={message} />}
        {!lesson && message && <p className="notice" role="status">{message}</p>}

        <section className="lower-grid"><Review items={state.review} /><Week items={state.week} /></section>
      </main>
    </div>
  );
}
