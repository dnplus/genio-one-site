#!/bin/sh
# GenioOne Community Edition installer
# https://github.com/dnplus/genio-one
#
# Usage:
#   curl -fsSL https://genio.sh/install.sh | sh
#   curl -fsSL https://genio.sh/install.sh | sh -s -- --dir /path/to/genio-one --ref main
#
# CE is source-first: no prebuilt binaries or container images are published.
# This script clones the repository, installs dependencies, and prepares the
# local .env files documented in docs/public/ce/quickstart.md. It does not
# start any service; you run `pnpm dev` yourself as the last step.
set -eu

REPO="dnplus/genio-one"
REPO_URL="https://github.com/${REPO}.git"
QUICKSTART_URL="https://github.com/${REPO}/blob/main/docs/public/ce/quickstart.md"

TARGET_DIR="${GENIO_INSTALL_DIR:-${PWD}/genio-one}"
REF="${GENIO_REF:-main}"
FORCE=0

# --- output helpers ----------------------------------------------------

if [ -t 2 ] && [ "${NO_COLOR:-}" = "" ]; then
  c_bold=$(printf '\033[1m') c_dim=$(printf '\033[2m')
  c_red=$(printf '\033[31m') c_green=$(printf '\033[32m') c_reset=$(printf '\033[0m')
else
  c_bold="" c_dim="" c_red="" c_green="" c_reset=""
fi

info()  { printf '%s\n' "$*" >&2; }
step()  { printf '%s==>%s %s\n' "$c_bold" "$c_reset" "$*" >&2; }
ok()    { printf '%s==>%s %s\n' "$c_green" "$c_reset" "$*" >&2; }
die()   { printf '%serror:%s %s\n' "$c_red" "$c_reset" "$*" >&2; exit 1; }
need()  { command -v "$1" >/dev/null 2>&1 || die "'$1' is required but was not found in PATH"; }

usage() {
  cat <<EOF
GenioOne Community Edition installer

Clones dnplus/genio-one and prepares it to run locally, following the
steps in docs/public/ce/quickstart.md.

USAGE:
    install.sh [OPTIONS]

OPTIONS:
    --dir <path>     Install into <path> (default: \$PWD/genio-one)
    --ref <ref>      Git branch, tag, or commit to check out (default: main)
    --force          Reuse an existing, non-empty target directory
    -h, --help       Print this help and exit

ENVIRONMENT:
    GENIO_INSTALL_DIR   Same as --dir
    GENIO_REF           Same as --ref
    NO_COLOR            Disable colored output

This script never runs the application; the last step is always printed
so you can review it before starting anything yourself.
EOF
}

# --- arg parsing ---------------------------------------------------------

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dir)
      [ "$#" -ge 2 ] || die "--dir requires a value"
      TARGET_DIR="$2"
      shift 2
      ;;
    --dir=*)
      TARGET_DIR="${1#--dir=}"
      shift
      ;;
    --ref)
      [ "$#" -ge 2 ] || die "--ref requires a value"
      REF="$2"
      shift 2
      ;;
    --ref=*)
      REF="${1#--ref=}"
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1 (see --help)"
      ;;
  esac
done

# --- checks ----------------------------------------------------------

check_prereqs() {
  step "Checking prerequisites"
  need git
  need node
  need docker
  command -v pnpm >/dev/null 2>&1 || die "pnpm is required: https://pnpm.io/installation"
  command -v bun >/dev/null 2>&1 || die "bun is required: https://bun.sh"
  docker compose version >/dev/null 2>&1 || die "docker compose (v2 plugin) is required"
  ok "git, node, pnpm, bun, docker compose all found"
}

check_target_dir() {
  if [ -e "$TARGET_DIR" ]; then
    if [ "$FORCE" != "1" ]; then
      die "target directory already exists: ${TARGET_DIR} (use --force to reuse it, or --dir to pick another path)"
    fi
    [ -d "$TARGET_DIR" ] || die "target path exists and is not a directory: ${TARGET_DIR}"
  fi
}

clone_repo() {
  step "Cloning ${REPO_URL} (ref: ${REF}) into ${TARGET_DIR}"
  if [ -d "${TARGET_DIR}/.git" ]; then
    info "  existing checkout found, fetching instead of cloning"
    git -C "$TARGET_DIR" fetch --depth 1 origin "$REF"
    git -C "$TARGET_DIR" checkout FETCH_HEAD
  else
    git clone --branch "$REF" --depth 1 "$REPO_URL" "$TARGET_DIR"
  fi
}

install_deps() {
  step "Installing dependencies (pnpm install --frozen-lockfile)"
  ( cd "$TARGET_DIR" && pnpm install --frozen-lockfile )
}

prepare_env_files() {
  step "Preparing local environment files"
  for app in apps/platform apps/bot; do
    example="${TARGET_DIR}/${app}/.env.example"
    target="${TARGET_DIR}/${app}/.env.local"
    if [ -f "$example" ] && [ ! -f "$target" ]; then
      cp "$example" "$target"
      info "  created ${app}/.env.local"
    fi
  done
}

main() {
  info "${c_bold}GenioOne Community Edition installer${c_reset}"
  info "${c_dim}${REPO_URL}${c_reset}"
  info ""

  check_prereqs
  check_target_dir
  clone_repo
  install_deps
  prepare_env_files

  info ""
  ok "GenioOne CE is ready in ${TARGET_DIR}"
  info ""
  info "Next steps:"
  info "  cd $(basename "$TARGET_DIR")"
  info "  pnpm dev"
  info ""
  info "Full quickstart and Gateway/MCP setup: ${QUICKSTART_URL}"
}

main
