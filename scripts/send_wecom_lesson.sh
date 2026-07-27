#!/bin/zsh

set -eu

script_dir="${0:A:h}"
project_root="${script_dir:h}"
env_file="${project_root}/.env"
state_file="${project_root}/.learning/state.json"

if [[ ! -f "$env_file" ]] || [[ ! -f "$state_file" ]]; then
  print -u2 "Missing .env or .learning/state.json."
  exit 64
fi

webhook_url=""
while IFS='=' read -r key value; do
  if [[ "$key" == "WECOM_WEBHOOK_URL" ]]; then
    webhook_url="$value"
    break
  fi
done < "$env_file"

if [[ -z "$webhook_url" ]]; then
  print -u2 "WECOM_WEBHOOK_URL is not configured in .env."
  exit 65
fi

payload=$(python3 - "$state_file" <<'PY'
import json
import sys

lesson = json.load(open(sys.argv[1], encoding="utf-8"))["today"]
content = "\n".join([
    "**Daily English · 20 min**",
    f"> {lesson['theme']}",
    f"[{lesson['source']} · {lesson['duration']}]({lesson['source_url']})",
    "",
    f"**Listen**  {lesson['listen_task']}",
    f"**Say**  {lesson['speaking_task']}",
])
print(json.dumps({"msgtype": "markdown", "markdown": {"content": content}}, ensure_ascii=False))
PY
)

/usr/bin/curl \
  --fail-with-body \
  --silent \
  --show-error \
  --max-time 20 \
  --request POST \
  --header 'Content-Type: application/json' \
  --data "$payload" \
  "$webhook_url"
