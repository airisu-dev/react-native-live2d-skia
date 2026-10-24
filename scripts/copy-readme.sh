#!/usr/bin/env bash
# The root README.md is the only copy kept in git. npm shows the package folder's README, so
# prepack copies it there (the copy is gitignored).
set -euo pipefail

cd "$(dirname "$0")/.."
cp README.md packages/react-native-live2d-skia/README.md
