#!/bin/bash
set -e
cd "$(dirname "$0")"
mkdir -p dist

node -e "
var spawn = require('child_process').spawnSync;
var fs = require('fs');
var r = spawn('/home/nicosia/.bun/bin/bun', [
  'build', './src/index.tsx',
  '--outdir', './dist',
  '--target', 'browser',
  '--format', 'iife',
  '--minify'
], {encoding:'utf8', cwd: '/home/nicosia/articoli-nucleare/joomla-component'});
process.stdout.write(r.stdout);
process.stderr.write(r.stderr);
if (r.status !== 0) process.exit(r.status);
var idx = '/home/nicosia/articoli-nucleare/joomla-component/dist/index.js';
var dst = '/home/nicosia/articoli-nucleare/joomla-component/dist/document-search.js';
if (fs.existsSync(idx)) {
  fs.renameSync(idx, dst);
  console.log('Renamed to document-search.js');
}
"
