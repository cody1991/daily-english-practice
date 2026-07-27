# Lesson Format

Create a JSON object compatible with `scripts/publish-lesson.js`:

```json
{
  "id": "2026-07-28-clarify",
  "date": "Tuesday, 28 July",
  "theme": "Ask for clarity without losing momentum",
  "source": "Source name",
  "source_type": "Video + English subtitles",
  "source_url": "https://example.com/source",
  "duration": "04:30",
  "segment": "00:00–04:30",
  "accent": "UK English",
  "listen_task": "First pass: identify what the speaker still needs clarified.",
  "speaking_task": "In 30 seconds, ask a colleague to explain one decision and say what you need next.",
  "phrases": [
    {"phrase": "Could you unpack that a little?", "note": "Ask for more detail without sounding lost."},
    {"phrase": "Just so I am clear, are we saying...?", "note": "Check shared understanding."},
    {"phrase": "What do you need from me next?", "note": "Turn clarity into action."}
  ]
}
```

Use 2-3 phrases. Make them idiomatic but transferable. Do not add a source transcript to the JSON.

`segment` is required even when the source itself is short. It must be an exact playable range in `MM:SS–MM:SS` or `HH:MM:SS–HH:MM:SS` form, starting at `00:00` for a whole short source. Do not write vague labels such as "selected segment".
