#!/usr/bin/env bash
# Builds the convex decomposers (V-HACD 4 and CoACD) as WebAssembly ES modules into packages/physics/src/wasm/, from pinned
# upstream commits, with Emscripten 4.0.10 (the version @mujoco/mujoco is built with). The outputs are committed, so the app and
# CI need no Emscripten; rebuild only to change a shim or a pinned version. docs/physics-plan.md, "Spike 2".
#
#   EMSDK=/path/to/emsdk packages/physics/decomposers/build.sh [work-dir]
#
# Needs git.
set -euo pipefail

VHACD_COMMIT=f900e42361491f525262d4825e758845e4969897   # kmammou/v-hacd, 2025-09-18
COACD_COMMIT=131010c4f03fec375ea88c5c6263f120046cb7f1   # SarahWeiii/CoACD, 2026-09-23
EMSCRIPTEN_VERSION=4.0.10

here="$(cd "$(dirname "$0")" && pwd)"
out="$here/../src/wasm"
work="${1:-$(mktemp -d)}"
: "${EMSDK:?Set EMSDK to an emsdk checkout with $EMSCRIPTEN_VERSION installed}"
"$EMSDK/emsdk" activate "$EMSCRIPTEN_VERSION" >/dev/null
# shellcheck disable=SC1091
source "$EMSDK/emsdk_env.sh" >/dev/null 2>&1
mkdir -p "$out" "$work"

fetch() { # repository, commit, directory
  if [ ! -d "$work/$3/.git" ]; then git init -q "$work/$3"; git -C "$work/$3" remote add origin "$1"; fi
  git -C "$work/$3" fetch -q --depth 1 origin "$2"
  git -C "$work/$3" checkout -q FETCH_HEAD
}

# Flags shared by both: an ES module embedding its .wasm (one file that Vite and Node both load), single-threaded, growable memory,
# deterministic (no fast-math), the C ABI of results.h exported.
EXPORTS='["_decompose","_hull_count","_hull_vertex_count","_hull_vertices","_hull_triangle_count","_hull_triangles","_release","_malloc","_free"]'
LINK=(-O3 -sMODULARIZE=1 -sEXPORT_ES6=1 -sSINGLE_FILE=1 -sENVIRONMENT=web,worker,node -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=5MB
  "-sEXPORTED_FUNCTIONS=$EXPORTS" '-sEXPORTED_RUNTIME_METHODS=["HEAPF64","HEAP32"]' -fexceptions)

fetch https://github.com/kmammou/v-hacd.git "$VHACD_COMMIT" v-hacd
em++ -std=c++17 -I"$work/v-hacd/include" -I"$here" "$here/vhacd.cpp" "${LINK[@]}" -sEXPORT_NAME=loadVhacd -o "$out/vhacd.mjs"

fetch https://github.com/SarahWeiii/CoACD.git "$COACD_COMMIT" coacd
git -C "$work/coacd" submodule update -q --init --depth 1
# CoACD's own CMake build as its WITH_3RD_PARTY_LIBS=OFF configuration: every source but the preprocessing, no spdlog, no threads
mapfile -t coacd_sources < <(find "$work/coacd/src" \( -name '*.cpp' -o -name '*.cc' \) ! -name 'preprocess*' | sort)
em++ -std=c++20 -DWITH_3RD_PARTY_LIBS=0 -DDISABLE_SPDLOG -DCOACD_STATIC -I"$work/coacd/public" -I"$work/coacd/3rd/cdt/CDT/include" \
  -I"$here" "${coacd_sources[@]}" "$work/coacd/public/coacd.cpp" "$here/coacd.cpp" "${LINK[@]}" -sEXPORT_NAME=loadCoacd -o "$out/coacd.mjs"

ls -l "$out"
