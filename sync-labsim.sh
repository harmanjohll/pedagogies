#!/usr/bin/env bash
# sync-labsim.sh — Pull selected content from the labsim repo into Co-Cher (pedagogies)
#
# Usage:  ./sync-labsim.sh [labsim-path]
#   labsim-path  defaults to ../labsim (sibling directory)
#
# What it syncs:
#   - interactives/*  → app/simulations/interactives/
#   - shared/*        → app/simulations/shared/
#
# It does NOT touch:
#   - chemistry/, physics/, biology/ simulations (maintained separately in Co-Cher)
#   - games/, flashcards/, safety/, dashboard/, teacher/ (not yet integrated)
#   - simulations.js catalogue (you must add new entries manually)
#
# After running, review changes with `git diff` and commit if satisfied.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LABSIM="${1:-$SCRIPT_DIR/../labsim}"

if [ ! -d "$LABSIM" ]; then
  echo "Error: labsim repo not found at $LABSIM"
  echo "Usage: $0 [path-to-labsim]"
  exit 1
fi

DEST="$SCRIPT_DIR/app/simulations"

echo "Syncing from: $LABSIM"
echo "          to: $DEST"
echo ""

# ── Interactives ──
if [ -d "$LABSIM/interactives" ]; then
  echo "• Syncing interactives..."
  mkdir -p "$DEST/interactives"
  rsync -av --delete \
    --exclude='index.html' \
    "$LABSIM/interactives/" "$DEST/interactives/"
  echo "  Done."
else
  echo "• No interactives/ directory found in labsim — skipping."
fi

# ── Shared design system & utilities ──
if [ -d "$LABSIM/shared" ]; then
  echo "• Syncing shared/ (design-system, dark-mode, utilities)..."
  rsync -av "$LABSIM/shared/" "$DEST/shared/"
  echo "  Done."
else
  echo "• No shared/ directory found in labsim — skipping."
fi

echo ""
echo "Sync complete. Review changes with:"
echo "  cd $SCRIPT_DIR && git diff"
echo ""
echo "Note: If new interactives were added, register them in"
echo "  app/js/views/simulations.js (SIMULATIONS array)."
