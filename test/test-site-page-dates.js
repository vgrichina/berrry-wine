'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createGitDates } = require('../tools/site-page-dates');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-dates-'));
const cacheFile = path.join(root, '.date-cache.json');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let day = 1;
const commit = message => {
  const date = `2025-01-${String(day++).padStart(2, '0')}T12:00:00+00:00`;
  execFileSync('git', ['commit', '-qm', message], { cwd: root,
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
};
const write = (name, text) => { fs.writeFileSync(path.join(root, name), text); git('add', '--', name); };
const files = ['one.md', 'two.md', 'quote"$(false).md', ' missing ', 'unknown.md'];
// Every answer must equal the per-path `git log -- path` walk, whatever route
// (cache, the one bulk walk, a per-path walk, prefetch) produced it.
const compare = ({ prefetch = false, bulk = true } = {}) => {
  const progress = [];
  const dates = createGitDates(root, { cacheFile, bulk, progress: s => progress.push(s) });
  if (prefetch) dates.prefetch(files);
  for (const rel of files) {
    const first = git('log', '--reverse', '--format=%cI', '--', rel).split('\n').find(Boolean);
    const last = git('log', '--format=%cI', '--', rel).split('\n').find(Boolean);
    assert.deepStrictEqual(dates.get(rel), { published: first ? first.slice(0, 10) : null,
      modified: last ? last.slice(0, 10) : null }, rel);
  }
  dates.save();
  return progress.at(-1);
};
try {
  git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  write('one.md', 'first'); write('two.md', 'first'); write(files[2], 'special'); write(files[3], 'space'); commit('initial');
  assert.match(compare(), /0 history queries, 5 from one walk, 0 cached/, 'cold cache: one walk answers all');
  assert.match(compare(), /0 history queries, 0 from one walk, 5 cached/);
  write('one.md', 'second'); write(files[3], 'changed space'); commit('edit');
  assert.match(compare(), /0 history queries, 2 from one walk, 3 cached/);
  // Edits reverted to identical bytes still change the modification date.
  write('two.md', 'second'); commit('edit two'); write('two.md', 'first'); commit('restore two');
  assert.match(compare(), /0 history queries, 1 from one walk, 4 cached/);
  const base = git('rev-parse', 'HEAD');
  git('checkout', '-qb', 'side'); write('one.md', 'side'); commit('side edit');
  git('checkout', '-qb', 'main-fixture', base); write('two.md', 'main'); commit('main edit');
  git('merge', '--no-ff', '-qm', 'merge', 'side');
  // The merge keeps the cache: only one.md (side) and two.md (main) refresh,
  // and one.md, touched off the first-parent line, takes the per-path walk.
  assert.match(compare(), /1 history queries, 1 from one walk, 3 cached/, 'merge refreshes only touched paths');
  // A merge that discards its side branch: per-path simplification hides the
  // side commit, which a plain global walk would count.
  git('checkout', '-qb', 'discard'); write('two.md', 'discarded'); commit('discarded edit');
  git('checkout', '-q', 'main-fixture'); git('merge', '-s', 'ours', '--no-ff', '-qm', 'ours', 'discard');
  assert.match(compare(), /1 history queries, 0 from one walk, 4 cached/, 'discarded side edit keeps its per-path walk');
  fs.rmSync(cacheFile);
  assert.match(compare({ prefetch: true }), /2 history queries, 3 from one walk/, 'prefetch: bulk plus parallel per-path walks');
  assert.match(compare({ bulk: false }), /0 history queries, 0 from one walk, 5 cached/);
  fs.rmSync(cacheFile);
  assert.match(compare({ bulk: false }), /5 history queries, 0 from one walk/, 'bulk can be turned off');
  git('mv', 'one.md', 'renamed.md'); commit('rename'); files.push('renamed.md'); compare();
  git('checkout', '-q', 'side'); assert.match(compare(), /0 history queries, 6 from one walk/, 'history rewrite refreshes dates');
  fs.writeFileSync(cacheFile, '{ broken'); compare();
  const partialFile = path.join(root, '.partial-dates.json');
  const partial = createGitDates(root, { cacheFile: partialFile, bulk: false });
  for (let i = 0; i < 25; i++) partial.get(`absent-${i}.md`);
  const resumedMessages = [];
  const resumed = createGitDates(root, { cacheFile: partialFile, progress: s => resumedMessages.push(s) });
  resumed.get('absent-0.md'); resumed.save();
  assert.match(resumedMessages.at(-1), /0 history queries, 0 from one walk, 1 cached/, 'checkpoint survives without final save');
  console.log('PASS page-date parity: cold/warm, one bulk walk, linear edits/reverts, merges kept incremental, discarded side branch, prefetch, rename, branch change, special paths, corrupt cache, interrupted preparation');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
