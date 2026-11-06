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
const compare = () => {
  const progress = [];
  const dates = createGitDates(root, { cacheFile, progress: s => progress.push(s) });
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
  assert.match(compare(), /5 history queries/);
  assert.match(compare(), /0 history queries, 5 cached/);
  write('one.md', 'second'); write(files[3], 'changed space'); commit('edit');
  assert.match(compare(), /2 history queries, 3 cached/);
  // Edits reverted to identical bytes still change the modification date.
  write('two.md', 'second'); commit('edit two'); write('two.md', 'first'); commit('restore two');
  assert.match(compare(), /1 history queries, 4 cached/);
  const base = git('rev-parse', 'HEAD');
  git('checkout', '-qb', 'side'); write('one.md', 'side'); commit('side edit');
  git('checkout', '-qb', 'main-fixture', base); write('two.md', 'main'); commit('main edit');
  git('merge', '--no-ff', '-qm', 'merge', 'side');
  assert.match(compare(), /5 history queries/, 'merge refreshes path-simplified histories');
  git('mv', 'one.md', 'renamed.md'); commit('rename'); files.push('renamed.md'); compare();
  git('checkout', '-q', 'side'); assert.match(compare(), /6 history queries/, 'history rewrite refreshes dates');
  fs.writeFileSync(cacheFile, '{ broken'); compare();
  const partialFile = path.join(root, '.partial-dates.json');
  const partial = createGitDates(root, { cacheFile: partialFile });
  for (let i = 0; i < 25; i++) partial.get(`absent-${i}.md`);
  const resumedMessages = [];
  const resumed = createGitDates(root, { cacheFile: partialFile, progress: s => resumedMessages.push(s) });
  resumed.get('absent-0.md'); resumed.save();
  assert.match(resumedMessages.at(-1), /0 history queries, 1 cached/, 'checkpoint survives without final save');
  console.log('PASS page-date parity: cold/warm, linear edits/reverts, merges, rename, branch change, special paths, corrupt cache, interrupted preparation');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
