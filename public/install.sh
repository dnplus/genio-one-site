#!/bin/sh
# GenioOne Community Edition installer
# Usage: curl -fsSL https://genio.sh/install.sh | sh
#
# CE is source-first: this script clones the repository and prepares the
# local environment files. It does not download prebuilt binaries or images.
set -eu

REPO="dnplus/genio-one"
REPO_URL="https://github.com/${REPO}.git"
TARGET_DIR="${GENIO_INSTALL_DIR:-$PWD/genio-one}"
REF="${GENIO_REF:-main}"

log() { printf '%s\n' "$*" >&2; }
die() { log "error: $*"; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required but not found in PATH"; }

check_prereqs() {
  need git
  need node
  need docker

  if command -v pnpm >/dev/null 2>&1; then
    :
  else
    log "pnpm not found. Install it first: https://pnpm.io/installation"
    exit 1
  fi

  if command -v bun >/dev/null 2>&1; then
    :
  else
    log "bun not found. Install it first: https://bun.sh"
    exit 1
  fi

  if docker compose version >/dev/null 2>&1; then
    :
  else
    die "docker compose is required (docker compose v2 plugin)"
  fi
}

main() {
  log "GenioOne Community Edition installer"
  log "Repository: ${REPO_URL} (ref: ${REF})"
  log ""

  check_prereqs

  if [ -e "$TARGET_DIR" ]; then
    die "target directory already exists: ${TARGET_DIR}"
  fi

  log "Cloning into ${TARGET_DIR} ..."
  git clone --branch "$REF" --depth 1 "$REPO_URL" "$TARGET_DIR"

  cd "$TARGET_DIR"

  log "Installing dependencies ..."
  pnpm install --frozen-lockfile

  for app in apps/platform apps/bot; do
    example="$app/.env.example"
    target="$app/.env.local"
    if [ -f "$example" ] && [ ! -f "$target" ]; then
      cp "$example" "$target"
      log "Created ${target}"
    fi
  done

  log ""
  log "GenioOne CE is ready to start."
  log ""
  log "  cd $(basename "$TARGET_DIR")"
  log "  pnpm dev"
  log ""
  log "Full quickstart: https://github.com/${REPO}/blob/main/docs/public/ce/quickstart.md"
}

main "$@"
