#!/bin/sh
# Type-check app/ + core/ against compile-only stubs (no Android SDK needed). See compile-stubs/README.md.
set -e
HERE=$(cd "$(dirname "$0")" && pwd); ROOT="$HERE/.."; OUT=${TMPDIR:-/tmp}/permcheck-stubcheck
KOTLINC=${KOTLINC:-kotlinc}
rm -rf "$OUT"; mkdir -p "$OUT/stubs"
javac -d "$OUT/stubs" $(find "$HERE/compile-stubs" -name '*.java')
"$KOTLINC" -cp "$OUT/stubs" -nowarn "$ROOT/core/src/main/kotlin" "$ROOT/app/src/main/kotlin" -d "$OUT/app" 2>&1
echo "app compiles against stubs"
