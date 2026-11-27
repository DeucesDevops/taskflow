#!/bin/bash

log() {
  printf '%s\n' "$*"
}

die() {
  printf '%s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

repo_root() {
  cd "$(dirname "$1")/.." && pwd
}

confirm_token() {
  expected="$1"
  actual="${2:-}"
  if [ "${actual}" != "${expected}" ]; then
    die "Refusing to continue. Re-run with ${expected}."
  fi
}
