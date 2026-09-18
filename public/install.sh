#!/bin/sh
# GenioOne Community Edition installer
# Usage: curl -fsSL https://genio.sh/install.sh | sh
set -eu

REPO="dnplus/genio-one"
INSTALL_DIR="${GENIO_INSTALL_DIR:-$HOME/.genio}"
BIN_DIR="$INSTALL_DIR/bin"

log() { printf '%s\n' "$*" >&2; }
die() { log "error: $*"; exit 1; }

detect_platform() {
  os=$(uname -s)
  arch=$(uname -m)
  case "$os" in
    Linux) os="linux" ;;
    Darwin) os="darwin" ;;
    *) die "unsupported OS: $os" ;;
  esac
  case "$arch" in
    x86_64|amd64) arch="amd64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) die "unsupported architecture: $arch" ;;
  esac
  printf '%s_%s\n' "$os" "$arch"
}

latest_release_tag() {
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name":' \
    | head -1 \
    | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/'
}

main() {
  command -v curl >/dev/null 2>&1 || die "curl is required"

  platform=$(detect_platform)
  log "GenioOne CE installer"
  log "Detected platform: ${platform}"

  tag=$(latest_release_tag || true)
  if [ -z "${tag:-}" ]; then
    log ""
    log "No published release found for ${REPO} yet."
    log "GenioOne Community Edition is available as source today:"
    log "  https://github.com/${REPO}"
    log ""
    log "Once a release is published, this script will download and install"
    log "the matching build for your platform automatically."
    exit 1
  fi

  asset="genio-one_${tag}_${platform}.tar.gz"
  url="https://github.com/${REPO}/releases/download/${tag}/${asset}"

  log "Latest release: ${tag}"
  log "Downloading ${url}"

  mkdir -p "$BIN_DIR"
  tmp_dir=$(mktemp -d)
  trap 'rm -rf "$tmp_dir"' EXIT

  curl -fsSL "$url" -o "$tmp_dir/$asset" \
    || die "failed to download release asset: $url"

  tar -xzf "$tmp_dir/$asset" -C "$tmp_dir"
  find "$tmp_dir" -maxdepth 1 -type f -perm -u+x -exec cp {} "$BIN_DIR/" \;

  log ""
  log "Installed to ${BIN_DIR}"
  log "Add it to your PATH:"
  log "  export PATH=\"${BIN_DIR}:\$PATH\""
}

main "$@"
