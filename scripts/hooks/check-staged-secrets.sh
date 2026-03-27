#!/usr/bin/env bash

set -euo pipefail

staged_files=()

while IFS= read -r file; do
  [[ -f "$file" ]] || continue

  case "$file" in
    *.avif|*.bin|*.bmp|*.gif|*.ico|*.jpeg|*.jpg|*.mov|*.mp3|*.mp4|*.ogg|*.pdf|*.png|*.tar|*.tgz|*.wav|*.webm|*.webp|*.woff|*.woff2|*.zip)
      continue
      ;;
  esac

  staged_files+=("$file")
done < <(git diff --cached --name-only --diff-filter=ACMR)

if (( ${#staged_files[@]} == 0 )); then
  exit 0
fi

bun run secrets:check -- "${staged_files[@]}"
