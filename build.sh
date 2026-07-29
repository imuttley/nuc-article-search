#!/bin/bash
set -e
cd "$(dirname "$0")"
mkdir -p dist

bun build ./src/index.tsx --outdir ./dist --target browser --format iife --minify

if [ -f ./dist/index.js ]; then
  mv ./dist/index.js ./dist/document-search.js
  echo 'Renamed to document-search.js'
fi

