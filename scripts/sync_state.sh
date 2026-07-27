#!/bin/zsh

set -eu

script_dir="${0:A:h}"
project_root="${script_dir:h}"
state_file=".learning/state.json"

cd "$project_root"

if [[ ! -f "$state_file" ]]; then
  print -u2 "Learning state does not exist."
  exit 64
fi

git add "$state_file"
if git diff --cached --quiet -- "$state_file"; then
  print "Already synced."
  exit 0
fi

git commit --only "$state_file" -m "Update learning progress"
git push
print "Progress synced to GitHub."
