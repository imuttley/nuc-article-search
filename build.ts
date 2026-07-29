import { spawnSync } from "child_process";
import { mkdirSync, existsSync, renameSync } from "fs";

const outdir = "./dist";
if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });

// Use node to invoke bun directly, bypassing bunfig.toml conflicts
const result = spawnSync(
  "node",
  [
    "-e",
    `
    const { spawnSync } = require('child_process');
    const r = spawnSync('/home/nicosia/.bun/bin/bun', [
      'build', './src/index.tsx',
      '--outdir', './dist',
      '--target', 'browser',
      '--format', 'iife',
      '--minify',
      '--sourcemap', 'external',
      '--banner', '/* @imuttley/nuc-article-search v1.0.0 | MIT License | CMS-agnostic WebComponent */'
    ], { encoding: 'utf8' });
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    process.exit(r.status);
    `,
  ],
  { encoding: "utf8", cwd: __dirname }
);

if (result.status !== 0) {
  console.error("Build failed:", result.stderr);
  process.exit(1);
}

// Rename index.js -> document-search.js for cleaner distribution name
try {
  const idx = `${outdir}/index.js`;
  const dst = `${outdir}/document-search.js`;
  if (existsSync(idx)) {
    renameSync(idx, dst);
    console.log("Renamed dist/index.js -> dist/document-search.js");
  }
} catch (e) {
  console.warn("Rename skipped:", e);
}

console.log("Build complete.");
