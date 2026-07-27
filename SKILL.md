---
name: daily-english-practice
description: Curate daily 20-minute English listening and speaking practice for an adult learner who wants stronger everyday and workplace communication. Use when creating a daily English lesson, selecting a short English audio/video with transcript, producing commute-friendly shadowing and speaking tasks, maintaining a local English learning queue, or sending a configured WeCom learning reminder.
---

# Daily English Practice

Create one complete, low-friction listening-and-speaking session per day. Optimise for doing the practice during a commute, not collecting resources.

## Learner Baseline

Assume this default profile unless the user overrides it:

- Strong reading foundation; listening and speaking need deliberate practice.
- Lives in the Netherlands and needs everyday conversation plus workplace English.
- Has 20 minutes a day.
- Prefers authentic, interesting material with English subtitles or a transcript.

## Daily Workflow

1. Read `references/source_policy.md` and `references/lesson_format.md`.
2. Read `.learning/state.json` when it exists. Avoid an already used canonical URL, avoid the same source family within 3 days, and avoid the same conversation scenario within 7 days unless it is a planned review.
3. Research current candidates with `agent-reach`. Prefer a 3-8 minute segment from an official source page, channel, or feed with English subtitles or a transcript. Record its exact start and end timestamps; do not label an unspecified clip as a "selected segment".
4. Choose one source that serves either workplace communication or everyday social English. Use work material about communication, feedback, clarification, disagreement, prioritisation, or meetings; do not choose generic business news by default.
5. Create exactly one lesson: a listening focus, 2-3 reusable phrases, and one 30-second speaking task. Do not overload the learner with extra links or vocabulary lists.
6. Save the lesson JSON locally, then run `scripts/publish_lesson.py` to update the dashboard state. The script preserves profile, prior activity, and the review queue. Run `scripts/sync_state.sh` after publication so the private GitHub repository receives the new lesson.
7. When the user has configured WeCom delivery, run `scripts/send_wecom_lesson.sh` after publication. It sends a concise reminder and the source link, not a copied transcript.

## Content Rules

- Use original source links. Do not reproduce full articles, full transcripts, or lyrics.
- Keep source quotations brief and necessary for the exercise. Prefer original task wording and paraphrase.
- State the source, content type, segment duration, exact playable time range, and accent when known.
- Make the speaking task concrete and personal: a 30-second retell, clarification, opinion, or workplace response.
- Keep the default day to 20 minutes: 8 minutes first listening, 5 minutes transcript-assisted listening, 4 minutes shadowing, and 3 minutes speaking/review.
- Treat `Too hard` feedback as a signal to select a shorter, slower, or more scaffolded source next time.
- Treat `Skip` as neutral. Do not punish the learner with an artificially harder or longer lesson.

## State and Delivery

The dashboard stores progress in `.learning/state.json`, which is versioned in this private repository so progress can be synced across machines. Keep Webhook credentials in ignored `.env` only.

```bash
python3 scripts/publish_lesson.py \
  /path/to/lesson.json \
  --project-root /path/to/daily-english-practice
```

When `.env` contains `WECOM_WEBHOOK_URL`, send the published reminder with:

```bash
scripts/send_wecom_lesson.sh
```

Sync the versioned learning state after generating a lesson, or use the dashboard's **Sync GitHub** button after logging practice:

```bash
scripts/sync_state.sh
```
