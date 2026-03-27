#!/usr/bin/env bash

set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Skipping lefthook install: not inside a Git work tree."
  exit 0
fi

bunx lefthook install
