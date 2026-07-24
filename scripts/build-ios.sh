#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WWW_DIR="$ROOT_DIR/www"

echo "Building Generator Power Advisor web assets for iOS..."

rm -rf "$WWW_DIR"
mkdir -p "$WWW_DIR"

cp "$ROOT_DIR/index.html" "$WWW_DIR/"
cp "$ROOT_DIR/app.js" "$WWW_DIR/"
cp "$ROOT_DIR/style.css" "$WWW_DIR/"
cp "$ROOT_DIR/manifest.json" "$WWW_DIR/"
cp "$ROOT_DIR/service-worker.js" "$WWW_DIR/"
cp "$ROOT_DIR/favicon.svg" "$WWW_DIR/"
cp "$ROOT_DIR/favicon-32.png" "$WWW_DIR/"
cp "$ROOT_DIR/apple-touch-icon.png" "$WWW_DIR/"
cp "$ROOT_DIR/icon-192.png" "$WWW_DIR/"
cp "$ROOT_DIR/icon-512.png" "$WWW_DIR/"

echo "iOS web bundle created in $WWW_DIR"
