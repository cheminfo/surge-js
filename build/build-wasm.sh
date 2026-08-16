#!/usr/bin/env bash
#
# Compile surge (and the nauty library it is built on) to WebAssembly, then
# embed the result into src/wasm/ as TypeScript modules.
#
# Both are plain C with no system calls beyond stdio, so nothing is patched:
# nauty is configured and built exactly as upstream does it, and surge is
# linked with the flags of its own Makefile minus `-march=native`.
#
# Runs inside the pinned emscripten image when emcc is not on the PATH, so a
# checkout with docker needs nothing else installed.

set -euo pipefail

EMSDK_IMAGE=emscripten/emsdk:6.0.6

NAUTY_VERSION=2_9_3
NAUTY_SHA256=9fc4edae04f88a0f5883985be3b39cf7f898fd6cc96e96b9ee25452743cc1b5b

SURGE_VERSION=2.0
SURGE_SHA256=e8f1298ef6f5ef5008ad8ae0c496ca91e654a5f8660ff117400f71abcfb97f97

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/out"

if ! command -v emcc >/dev/null 2>&1; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "error: neither emcc (Emscripten) nor docker found in PATH" >&2
    echo "Install Emscripten (https://emscripten.org/) or Docker." >&2
    exit 1
  fi
  echo ">> emcc not found, building in $EMSDK_IMAGE"
  exec docker run --rm -v "$PACKAGE_DIR":/work -w /work "$EMSDK_IMAGE" \
    bash build/build-wasm.sh
fi

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

fetch() {
  local url="$1" file="$2" expected="$3"
  [ -f "$file" ] || curl -fsSL -o "$file" "$url"
  local actual
  actual="$(sha256sum "$file" | cut -d' ' -f1)"
  if [ "$actual" != "$expected" ]; then
    echo "error: checksum mismatch for $file" >&2
    echo "  expected $expected" >&2
    echo "  actual   $actual" >&2
    exit 1
  fi
}

echo ">> Building nauty $NAUTY_VERSION"
fetch "https://users.cecs.anu.edu.au/~bdm/nauty/nauty${NAUTY_VERSION}.tar.gz" \
  nauty.tar.gz "$NAUTY_SHA256"
[ -d "nauty${NAUTY_VERSION}" ] || tar xzf nauty.tar.gz
NAUTY_DIR="$BUILD_DIR/nauty${NAUTY_VERSION}"
if [ ! -f "$NAUTY_DIR/nautyL1.a" ]; then
  cd "$NAUTY_DIR"
  # popcnt and clz are detected by running a compiled probe, which configure
  # cannot do when the compiler emits wasm; the builtins compile to the
  # WebAssembly instructions of the same name either way.
  emconfigure ./configure --disable-popcnt --disable-clz
  emmake make -j"$(nproc)" nautyL1.a
  cd "$BUILD_DIR"
fi

echo ">> Building surge $SURGE_VERSION"
fetch "https://github.com/StructureGenerator/surge/archive/refs/tags/v${SURGE_VERSION}.tar.gz" \
  surge.tar.gz "$SURGE_SHA256"
[ -d "surge-${SURGE_VERSION}" ] || tar xzf surge.tar.gz
SURGE_SRC="$BUILD_DIR/surge-${SURGE_VERSION}/src"

# The defines are surge's own Makefile: geng.c provides the generator and
# surge.c the main(), the callbacks being wired together by name.
emcc -o "$BUILD_DIR/surge.mjs" \
  -O3 -I "$NAUTY_DIR" \
  -DWORDSIZE=64 -DMAXN=WORDSIZE \
  -DOUTPROC=surgeproc -DPREPRUNE=surgepreprune \
  -DPRUNE=surgeprune -DGENG_MAIN=geng_main \
  "$SURGE_SRC/surge.c" "$SURGE_SRC/geng.c" "$SURGE_SRC/planarity.c" \
  "$NAUTY_DIR/nautyL1.a" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sINVOKE_RUN=0 -sEXIT_RUNTIME=1 \
  -sEXPORTED_RUNTIME_METHODS=callMain,FS \
  -sINCOMING_MODULE_JS_API=wasmBinary,noInitialRun,thisProgram,print,printErr,onExit \
  -sALLOW_MEMORY_GROWTH=1 -sENVIRONMENT=web,worker \
  -sSTACK_SIZE=1048576

echo ">> Embedding artifacts into src/wasm/"
node "$SCRIPT_DIR/embed-wasm.js" \
  --wasm "$BUILD_DIR/surge.wasm" \
  --glue "$BUILD_DIR/surge.mjs" \
  --out-data "$PACKAGE_DIR/src/wasm/data.ts" \
  --out-glue "$PACKAGE_DIR/src/wasm/glue.ts" \
  --out-version "$PACKAGE_DIR/src/version.ts" \
  --surge-version "$SURGE_VERSION" \
  --nauty-version "${NAUTY_VERSION//_/.}" \
  --emscripten-version "$(emcc -dumpversion)"

echo ">> Done"
