# Daily English Practice

Local-first daily listening and speaking practice for an adult learner building everyday and workplace English. It uses a Node + Express API and a React dashboard.

## Run the Dashboard

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

The dashboard records `Done`, `Too hard`, and `Skip today` actions in `.learning/state.json`. The learning state is versioned with this private project so course history and progress can be synced; `.env` remains local and ignored.

## Publish a Lesson

Create a lesson JSON following `references/lesson_format.md`, then publish it:

```bash
node scripts/publish-lesson.js lesson.json --project-root .
```

Every lesson includes an exact source time range such as `00:00–04:30`, so the listening task can begin immediately.

When `.env` contains `WECOM_WEBHOOK_URL`, send the compact daily reminder:

```bash
node scripts/send-wecom-lesson.js
```

## Sync Progress

The dashboard keeps learning progress in `.learning/state.json`. Click **Sync GitHub** after logging a lesson to commit and push that file to the private repository. The daily automation syncs newly published lessons automatically. `.env` is never committed.

Completed lessons add their reusable phrases to the review queue for three days later. Skipped and too-hard lessons do not add review items.

Run `npm test` for the state-rule tests and `npm run build` to verify the production frontend build.
