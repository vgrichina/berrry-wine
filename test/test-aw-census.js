#!/usr/bin/env node
'use strict';

// The A/W census is a build ratchet, not just a report. It must reject a new
// independent implementation even when an old one was fixed in the same
// change and the total issue count therefore stayed flat.

const assert = require('assert');
const {
  classify, collectPairs, issueSet, compareBaseline, checkBaseline,
} = require('../tools/aw-census.js');

let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };

const pairs = collectPairs();
const live = issueSet(pairs);
const result = checkBaseline(pairs);
check(result.additions.length === 0,
  `live tree has no unbaselined A/W drift: ${result.additions.join(', ')}`);
check(['STUB', 'DIVERGENT', 'BOTH_STUB'].every(kind => Array.isArray(live[kind])),
  'the live census exposes every ratcheted issue class');
check(live.STUB.length === 0, `no one-sided stubs remain (${live.STUB.length})`);

// Encoding adaptation must still converge on the registration implementation.
// Neither a baseline exception nor an incidental gl32 call seals this pair.
for (const base of ['RegisterClass', 'RegisterClassEx']) {
  const pair = pairs.find(p => p.base === base);
  check(pair && pair.kind === 'SHARED', `${base} shares its encoding-aware core`);
  const split = {...pair.w, body: pair.w.body.map(line =>
    line.replace(/\$class_table_register_encoded/g, '$independent_registration'))};
  check(classify(pair.a, split) === 'DIVERGENT',
    `${base} rejects a disconnected registration implementation`);
  const changed = pairs.map(p => p === pair ? {...p, w: split, kind: classify(p.a, split)} : p);
  check(checkBaseline(changed).additions.includes(`DIVERGENT ${base}A/W`),
    `${base} disconnection remains a new baseline violation`);
}

const fake = kind => ({ base: kind, kind: 'DIVERGENT' });
const sameCount = compareBaseline(
  [fake('OldFixed'), fake('NewRegression')],
  { STUB: [], DIVERGENT: ['OldFixed', 'OldStillHere'], BOTH_STUB: [] });
check(sameCount.added.DIVERGENT.length === 1 && sameCount.added.DIVERGENT[0] === 'NewRegression',
  'a replacement regression fails even when the divergent count stays flat');
check(sameCount.fixed.DIVERGENT.length === 1 && sameCount.fixed.DIVERGENT[0] === 'OldStillHere',
  'the same comparison still reports the fixed baseline name');

const improvement = compareBaseline(
  [fake('StillHere')],
  { STUB: [], DIVERGENT: ['Fixed', 'StillHere'], BOTH_STUB: [] });
check(improvement.added.DIVERGENT.length === 0,
  'removing an independent pair is an allowed ratchet improvement');
check(improvement.fixed.DIVERGENT.join(',') === 'Fixed',
  'the improvement is named so the baseline can be trimmed');

const handler = (name, call) => ({
  name,
  lines: 5,
  body: [`  (func $handle_${name}`, `    (call $${call})`, '  )'],
});
check(classify(
  handler('LegacyA', 'handle_CanonicalA'),
  handler('LegacyW', 'handle_CanonicalW')) === 'SHARED',
'matching downstream A/W delegates count as one audited family');
check(classify(
  handler('LegacyA', 'handle_FirstA'),
  handler('LegacyW', 'handle_SecondW')) === 'DIVERGENT',
'different downstream families remain divergent');

console.log(`PASS  A/W census ratchet (${checks} checks, ${pairs.length} live pairs)`);
