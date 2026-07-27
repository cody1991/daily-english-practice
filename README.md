# Daily English Practice

Local-first daily listening and speaking practice for an adult learner building everyday and workplace English.

## Run the Dashboard

```bash
python3 app/server.py
```

Open `http://127.0.0.1:4173`.

The dashboard records `Done`, `Too hard`, and `Skip today` actions in ignored local state at `.learning/state.json`.

## Publish a Lesson

Create a lesson JSON following `references/lesson_format.md`, then publish it:

```bash
python3 scripts/publish_lesson.py lesson.json --project-root .
```

When `.env` contains `WECOM_WEBHOOK_URL`, send the compact daily reminder:

```bash
scripts/send_wecom_lesson.sh
```
