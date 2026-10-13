#!/usr/bin/env node
//
// How well is guest-thread work actually SCHEDULED?
//
//   node tools/thread-schedule-census.js <profile.json>
//   node tools/thread-schedule-census.js -            # read stdin
//
// The profile is whatever `ThreadManager.schedulerStats()` returns. On a phone
// or any browser session:
//
//   node tools/ios-eval.js 'JSON.stringify(window.wineShell.runningApps[0]
//     .wine.threadManager.schedulerStats())' > /tmp/sched.json
//
// (call `.resetSchedulerStats()` first to scope it to one scene).
//
// ---------------------------------------------------------------- why ------
// Throughput aggregates cannot answer this question, and the reason is
// structural: the handler histogram lives in ONE array in shared linear
// memory, so every guest thread accumulates into it. Work a thread never did
// is therefore indistinguishable from work the others did, and a thread that
// is handed a third of every batch and retires nothing looks exactly like a
// thread pulling its weight.
//
// The scheduler divides its block budget by the number of ACTIVE threads
// (thread-manager.js, `activeCount`), and "active" includes a thread parked
// forever on a wait handle. So the split can be wrong in a way no ops/s number
// reveals. This reads the one pairing that settles it: budget GRANTED beside
// blocks RETIRED, per thread.
//
// -------------------------------------------------------------- output -----
// Per thread: budget share, block share, utilisation (retired/granted), and
// how each offer ended -- ran, parked (asked, could not run), or skipped.
// Then verdicts naming any thread whose budget share materially exceeds the
// work it did.
//
// Utilisation is NOT expected to be 1.0: a run stops at the first blocking
// yield, so a thread doing real work still returns early. Read it as a
// RELATIVE measure between threads in one profile, and read `parked` and
// `emptyRun` as the absolute waste signals.

'use strict';

const fs = require('fs');

function bar(share, width = 24) {
  const filled = Math.max(0, Math.min(width, Math.round(share * width)));
  return '#'.repeat(filled) + '.'.repeat(width - filled);
}

const pct = v => `${(v * 100).toFixed(1)}%`;
const num = v => (v | 0).toLocaleString('en-US');

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node tools/thread-schedule-census.js <profile.json>|-');
    process.exit(2);
  }
  const raw = arg === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(arg, 'utf8');
  let profile;
  try {
    profile = JSON.parse(raw);
    // ios-eval hands back a STRING (the page JSON.stringify'd it), so a profile
    // captured that way arrives double-encoded. Unwrap rather than making the
    // caller care.
    if (typeof profile === 'string') profile = JSON.parse(profile);
  } catch (error) {
    console.error(`not valid JSON: ${error.message}`);
    process.exit(1);
  }
  const threads = profile && profile.threads;
  if (!Array.isArray(threads) || !threads.length) {
    console.error('no threads in this profile — is it the output of schedulerStats()?');
    process.exit(1);
  }

  console.log('thread scheduling census');
  console.log(`  blocks retired ${num(profile.totalBlocks)} against ${num(profile.totalBudget)} granted` +
    `  (overall utilisation ${pct(profile.utilisation || 0)})`);
  console.log('');
  console.log('  tid      state     budget%  blocks%  util    offers      ran    parked   empty');
  for (const t of threads) {
    const line = [
      String(t.tid).padStart(8),
      (t.state || '').padEnd(9),
      pct(t.budgetShare).padStart(8),
      pct(t.blockShare).padStart(8),
      pct(t.utilisation).padStart(7),
      num(t.offered).padStart(9),
      num(t.run).padStart(9),
      num(t.parked).padStart(9),
      num(t.emptyRun).padStart(7),
    ].join(' ');
    console.log('  ' + line);
  }

  console.log('');
  console.log('  block share vs budget share');
  for (const t of threads) {
    console.log(`  T${String(t.tid).padEnd(7)} work   ${bar(t.blockShare)} ${pct(t.blockShare)}`);
    console.log(`  ${' '.repeat(8)} budget ${bar(t.budgetShare)} ${pct(t.budgetShare)}`);
  }

  // ---- verdicts ----------------------------------------------------------
  console.log('');
  const notes = [];
  for (const t of threads) {
    // A thread granted a materially larger share of the budget than the work
    // it returned is the mis-scheduling this tool exists to name.
    const gap = t.budgetShare - t.blockShare;
    if (gap > 0.05) {
      notes.push(`T${t.tid} takes ${pct(t.budgetShare)} of the budget and returns ` +
        `${pct(t.blockShare)} of the work (gap ${pct(gap)})`);
    }
    if (t.offered > 100 && t.parkShare > 0.5) {
      notes.push(`T${t.tid} was parked on ${pct(t.parkShare)} of its ${num(t.offered)} offers ` +
        `— counted active, cannot run, still divides the budget`);
    }
    if (t.run > 100 && t.emptyRunShare > 0.5) {
      notes.push(`T${t.tid} retired zero blocks on ${pct(t.emptyRunShare)} of ${num(t.run)} runs ` +
        '— it enters run() and comes straight back out');
    }
    if (t.waitPolls > 10000 && !t.blocks) {
      notes.push(`T${t.tid} has ${num(t.waitPolls)} wait-polls and has retired no blocks at all`);
    }
  }
  if (!notes.length) {
    console.log('  no thread is taking materially more budget than the work it returns.');
  } else {
    for (const n of notes) console.log(`  * ${n}`);
  }

  // The headline: budget handed to threads that retired nothing.
  const dead = threads.filter(t => !t.blocks);
  if (dead.length) {
    const wasted = dead.reduce((a, t) => a + t.budgetShare, 0);
    console.log('');
    console.log(`  ${dead.length} thread(s) retired NO blocks yet hold ${pct(wasted)} of the granted budget: ` +
      dead.map(t => `T${t.tid}`).join(', '));
  }
}

main();
