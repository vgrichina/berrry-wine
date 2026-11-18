'use strict';
const assert = require('node:assert/strict');
const {deliver} = require('../tools/nfs3-current-browser-driving.cjs');

(async () => {
  // The observed old ordering armed a 1750ms UP, then spent >1250ms reading
  // live owner identities, leaving no physical DOWN window. This is pre-effect.
  let oldClock = 0, oldDown = 0;
  const oldFallback = oldClock + 1750;
  oldClock += 1600;
  assert.throws(() => { assert(oldClock < oldFallback - 500); oldDown++; });
  assert.equal(oldDown, 0);

  let clock = 0, down = 0, finished = 0, scheduled, calls = [];
  const release = () => ({fallback: clock + 1750,
    schedule(at) { scheduled = at; calls.push('schedule'); },
    async finish() { finished++; calls.push('wait'); return {actualWait:true}; }});
  const result = await deliver({now: () => clock, holdMs: 700,
    async validate() { calls.push('validate'); clock += 1600; },
    async arm() { calls.push('arm'); return release(); },
    async down() { calls.push('down'); down++; clock += 20; }});
  assert.deepEqual(calls, ['validate', 'arm', 'down', 'schedule', 'wait']);
  assert.equal(result.downAt, 1600); assert.equal(scheduled, 2300);
  assert.equal(result.fallback, 3350); assert.equal(down, 1); assert.equal(finished, 1);

  let armed = 0;
  await assert.rejects(deliver({async validate() { throw Error('owner replaced'); },
    async arm() { armed++; }, async down() { down++; }}), /owner replaced/);
  assert.equal(armed, 0); assert.equal(down, 1);

  await assert.rejects(deliver({now:()=>clock, validate:async()=>{}, arm:async()=>release(),
    down:async()=>{throw Error('UNKNOWN transport; caller closes scope');}}), /UNKNOWN transport/);
  assert.equal(finished, 2);

  await assert.rejects(deliver({now:()=>clock, validate:async()=>{},
    arm:async()=>({...release(),fallback:clock+100}), down:async()=>{down++;}}), /NOT_SENT/);
  assert.equal(down, 1); assert.equal(finished, 3);
  for (const holdMs of [0,49,1201,NaN,100.5]) await assert.rejects(deliver({holdMs}));
  console.log('PASS observed old no-DOWN failure; validation before independent arm preserves 700ms hold; owner replacement, UNKNOWN release wait and finite refusal');
})().catch(e=>{console.error(e);process.exitCode=1;});
