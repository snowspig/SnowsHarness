#!/usr/bin/env bash
# deploy.sh — Bash deploy script for SnowsHarness
# Equivalent to deploy.ps1 for Linux/macOS
#
# Usage:
#   ./deploy.sh              # Interactive deploy (prompts for mode)
#   ./deploy.sh --dry-run    # Preview only
#   ./deploy.sh --force      # Deploy without prompts (defaults to mini)
#   ./deploy.sh --mini       # Deploy compressed rules
#   ./deploy.sh --full       # Deploy full rules

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
FORCE=false
DRY_RUN=false
MINI_MODE=""  # Empty = not set by CLI, will prompt interactively

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY_RUN=true ;;
    --force|-f)   FORCE=true ;;
    --mini|-m)    MINI_MODE=true ;;
    --full)       MINI_MODE=false ;;
    --help|-h)
      echo "Usage: $0 [--dry-run|--force|--mini|--full]"
      echo "  --dry-run, -n   Preview what will change"
      echo "  --force, -f     Deploy without prompts"
      echo "  --mini, -m      Deploy compressed rules (saves ~17% tokens)"
      echo "  --full          Deploy full rules (default, unless chosen interactively)"
      exit 0
      ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# Interactive mode selection if not specified and not forced/dry-run
if [[ -z "$MINI_MODE" ]] && ! $FORCE && ! $DRY_RUN; then
  echo ""
  echo "Select deployment mode:"
  echo "  1) full  - Complete rules with detailed examples (baseline)"
  echo "  2) mini  - Compressed rules, ~17% token savings (daily dev)"
  echo ""
  read -rp "Choose mode [1/2, default: 2]: " mode_choice
  case $mode_choice in
    1) MINI_MODE=false; log_status "Mode: full" ;;
    2|"") MINI_MODE=true; log_status "Mode: mini" ;;
    *) log_warn "Invalid choice, defaulting to mini"; MINI_MODE=true ;;
  esac
  echo ""
elif [[ -z "$MINI_MODE" ]] && $FORCE; then
  # Default to mini when forced without explicit choice
  MINI_MODE=true
fi

# Logging functions
log_status() { echo "[DEPLOY] $1"; }
log_ok()     { echo "[OK]     $1"; }
log_warn()   { echo "[WARN]   $1" >&2; }
log_fail()   { echo "[FAIL]   $1" >&2; }

# Pre-checks
if [[ ! -d "$CLAUDE_DIR" ]]; then
  log_fail "~/.claude/ not found. Is Claude Code installed?"
  exit 1
fi

SETTINGS_FILE="$CLAUDE_DIR/settings.json"
if [[ ! -f "$SETTINGS_FILE" ]]; then
  log_warn "settings.json not found. A template will be created."
fi

# SHA-256 hash function
sha256_file() {
  if command -v sha256sum &>/dev/null; then
    sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum &>/dev/null; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    echo "different"
  fi
}

# Components to deploy
declare -A COMPONENTS
COMPONENTS[hooks]="*.js"
COMPONENTS[commands]="*.md"
COMPONENTS[agents]="*.md"

# Determine rules source based on mode
if [[ "$MINI_MODE" == "true" ]]; then
  RULES_SRC="rules-mini"
  log_status "Using compressed rules (mini mode, ~17% token savings)"
else
  RULES_SRC="rules"
  log_status "Using full rules (complete guidelines and examples)"
fi

# Deploy files
total_copied=0

for name in hooks rules commands agents; do
  filter="${COMPONENTS[$name]}"
  if [[ "$name" == "rules" ]]; then
    src_dir="$SCRIPT_DIR/$RULES_SRC"
  else
    src_dir="$SCRIPT_DIR/$name"
  fi
  dest_dir="$CLAUDE_DIR/$name"

  [[ -d "$src_dir" ]] || continue

  if [[ ! -d "$dest_dir" ]]; then
    if $DRY_RUN; then
      log_status "Would create: $dest_dir"
    else
      mkdir -p "$dest_dir"
    fi
  fi

  while IFS= read -r -d '' file; do
    rel_path="${file#$src_dir/}"
    dest_path="$dest_dir/$rel_path"
    dest_parent="$(dirname "$dest_path")"

    [[ -d "$dest_parent" ]] || mkdir -p "$dest_parent"

    should_copy=false
    if [[ -f "$dest_path" ]]; then
      src_hash="$(sha256_file "$file")"
      dest_hash="$(sha256_file "$dest_path")"
      if [[ "$src_hash" != "$dest_hash" ]]; then
        if $FORCE; then
          should_copy=true
        elif ! $DRY_RUN; then
          read -rp "Overwrite $name/$rel_path? [y/N] " answer
          [[ "$answer" =~ ^[yY]$ ]] && should_copy=true
        fi
      fi
    else
      should_copy=true
    fi

    if $should_copy; then
      if $DRY_RUN; then
        log_status "Would copy: $name/$rel_path"
      else
        cp "$file" "$dest_path"
        log_ok "$name/$rel_path"
      fi
      ((total_copied++)) || true
    fi
  done < <(find "$src_dir" -name "$filter" -type f -print0)
done

# Merge settings.json hooks
TEMPLATE_FILE="$SCRIPT_DIR/settings.template.json"
if [[ -f "$TEMPLATE_FILE" ]]; then
  log_status "Merging hook registrations into settings.json..."

  if $DRY_RUN; then
    log_status "Would merge hooks from template"
  else
    if [[ ! -f "$SETTINGS_FILE" ]]; then
      cp "$TEMPLATE_FILE" "$SETTINGS_FILE"
      log_ok "Created settings.json from template"
    else
      # Determine POWERSHELL_TOOL value based on platform
      if [[ "$(uname -s)" == "Linux" || "$(uname -s)" == "Darwin" ]]; then
        PSHELL_VAL="0"
      else
        PSHELL_VAL="1"
      fi

      # Merge hooks using jq: add new events/matchers from template,
      # preserve all existing settings (env, permissions, plugins).
      tmp_file=$(mktemp)
      jq --arg pshell "$PSHELL_VAL" '
        . as $existing |
        (input) as $template |
        # Merge hooks
        .hooks = (($existing.hooks // {}) |
          reduce ($template.hooks | keys[]) as $event (
            .;
            .[$event] = (($existing.hooks[$event] // []) +
              [$template.hooks[$event][] |
                select(.matcher as $m |
                  ($existing.hooks[$event] // []) |
                  all(.matcher != $m)
                )
              ]
            )
          )
        ) |
        # Merge mcpServers (additive only)
        .mcpServers = (($existing.mcpServers // {}) + ($template.mcpServers // {})) |
        # Merge permissions.allow (additive)
        .permissions.allow = (($existing.permissions.allow // []) + [
          $template.permissions.allow[] |
          select(. as $p | ($existing.permissions.allow // []) | index($p) | not)
        ]) |
        .env.CLAUDE_CODE_USE_POWERSHELL_TOOL = $pshell
      ' "$SETTINGS_FILE" "$TEMPLATE_FILE" > "$tmp_file" && mv "$tmp_file" "$SETTINGS_FILE"

      log_ok "settings.json hooks merged"
    fi
  fi
fi

# Summary
echo ""
if $DRY_RUN; then
  log_status "Dry run complete. $total_copied files would be deployed."
  if $MINI_MODE; then
    log_status "Mode: mini (compressed rules)"
  else
    log_status "Mode: full (complete rules)"
  fi
  log_status "Run without --dry-run to apply."
else
  log_ok "Deploy complete. $total_copied files deployed."
  echo ""
  if $MINI_MODE; then
    log_status "Deployed with compressed rules (mini mode)"
  else
    log_status "Deployed with full rules"
  fi
  echo ""
  log_status "Next steps:"
  echo "  1. Review settings.json for hooks and env vars"
  echo "  2. Run /harness-check to verify everything"
  echo "  3. Install plugins: /plugin install <name>"
  echo ""
  echo "To switch modes later:"
  echo "  node ~/.claude/hooks/switch-harness-mode.js [mini|full]"
fi
