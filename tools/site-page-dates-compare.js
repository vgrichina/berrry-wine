#!/usr/bin/env node
'use strict';
// Check bulkGitDates (one history walk) against exact per-path dates.
//
//   node tools/site-page-dates-compare.js [CACHE.json] [--walk-uncertain]
//
//   CACHE.json (per-path, exact; default build/site-page-dates.json) ─┐
//                                                                    ├─▶ mismatches
//   bulkGitDates at the cache's own HEAD (one walk) ─────────────────┘
//
// Paths bulkGitDates marks uncertain are skipped -- the generator still walks
// those per path. --walk-uncertain also checks that every uncertain path's
// per-path answer is what the cache holds (slow: one walk each). Exit 1 on any
// mismatch among the paths bulk answers.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { bulkGitDates } = require('./site-page-dates');

const ROOT = path.join(__dirname, '..');
const cacheFile = process.argv.slice(2).find(a => !a.startsWith('--')) ||
  path.join(ROOT, 'build/site-page-dates.json');
const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
const git = (args, trim = true) => {
  const out = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  return trim ? out.trim() : out;
};

const t0 = Date.now();
const { dates, uncertain, loose } = bulkGitDates(git, cache.head);
const ms = Date.now() - t0;
let same = 0, skipped = 0, looseSame = 0;
const bad = [], looseBad = [];
for (const [rel, want] of Object.entries(cache.entries)) {
  if (uncertain.has(rel)) {
    skipped++;
    // How the plain walk (side commits counted) would have answered it.
    const got = loose.get(rel) || { published: null, modified: null };
    if (got.published === want.published && got.modified === want.modified) looseSame++;
    else looseBad.push({ rel, want, got });
    continue;
  }
  const got = dates.get(rel) || { published: null, modified: null };
  if (got.published === want.published && got.modified === want.modified) same++;
  else bad.push({ rel, want, got });
}
console.log(`head ${cache.head.slice(0, 10)}: one walk ${ms} ms; ${same} match, ` +
  `${bad.length} differ, ${skipped} uncertain (per-path walk kept)`);
for (const b of bad.slice(0, 20)) console.log(`  DIFF ${b.rel} want ${JSON.stringify(b.want)} got ${JSON.stringify(b.got)}`);
console.log(`uncertain paths, plain walk: ${looseSame} would match, ${looseBad.length} would differ`);
for (const b of looseBad.slice(0, 8)) console.log(`  UNCERTAIN ${b.rel} want ${JSON.stringify(b.want)} plain ${JSON.stringify(b.got)}`);
process.exitCode = bad.length ? 1 : 0;
