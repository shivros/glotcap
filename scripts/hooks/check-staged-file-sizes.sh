#!/usr/bin/env bash

set -euo pipefail

readonly max_bytes=$((5 * 1024 * 1024))
oversized_files=()

format_mebibytes() {
  local bytes=$1
  awk "BEGIN { printf \"%.1f MiB\", ${bytes} / 1024 / 1024 }"
}

while IFS= read -r file; do
  [[ -f "$file" ]] || continue

  file_size=$(wc -c < "$file")
  if (( file_size > max_bytes )); then
    oversized_files+=("$file ($(format_mebibytes "$file_size"))")
  fi
done < <(git diff --cached --name-only --diff-filter=AM)

if (( ${#oversized_files[@]} == 0 )); then
  exit 0
fi

echo "Refusing to commit staged files larger than 5 MiB:" >&2
printf '  - %s\n' "${oversized_files[@]}" >&2
echo "If one of these really belongs in Git, split it out or raise the limit in scripts/hooks/check-staged-file-sizes.sh." >&2

exit 1
