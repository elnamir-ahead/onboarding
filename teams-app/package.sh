#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

for f in manifest.json color.png outline.png; do
  if [[ ! -f "$f" ]]; then
    echo "Missing required file: $f"
    exit 1
  fi
done

ZIP_NAME="ARCHIE-Test-teams-app.zip"
rm -f "$ZIP_NAME"
zip -9 "$ZIP_NAME" manifest.json color.png outline.png
echo "Created $ZIP_NAME"
