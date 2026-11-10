'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {arm} = require('./native-timed-images.cjs');
const wait = ms => new Promise(r => setTimeout(r, ms));
function guard() { let failure; return {
  fail(e) { failure ??= e; }, check() { if (failure) throw failure; },
  get failure() { return failure; }
}; }
test('slow owner read cannot serialize either screenshot; done validates once', async () => {
  const g = guard(), events = []; let saves = 0, reads = 0;
  const images = arm({guard:g, delays:[5, 15], deadline:Date.now()+1000,
    capture:async i => { events.push('shot'+i); return Buffer.from('png'+i); },
    validate:async () => { reads++; events.push('read'); await wait(60); return 'bound'; },
    save:r => { saves++; assert.equal(r.binding,'bound'); }});
  // Simulate independent native release before collecting evidence.
  await wait(30); assert.deepEqual(events,['shot0','shot1']);
  const [a,b] = await Promise.all([images.done(),images.done()]);
  assert.equal(a,b); assert.equal(reads,1); assert.equal(saves,1);
  assert(a.every(r => r.completedAt-images.armedAt < 30));
});
test('owner replacement invalidates all provisional images and closes guard', async () => {
  const g = guard(), error = Error('owner replaced'); let saved = false;
  const images = arm({guard:g,delays:[0],deadline:Date.now()+1000,
    capture:async()=> 'png',validate:async()=>{throw error;},save:()=>saved=true});
  await assert.rejects(images.done(),e=>e===error);
  assert.equal(g.failure,error); assert.equal(saved,false);
});
test('first screenshot failure suppresses later requests and all validation', async () => {
  const g = guard(), error = Error('UNKNOWN capture'); let calls=0;
  const images = arm({guard:g,delays:[0,15],deadline:Date.now()+1000,
    capture:async()=>{calls++;throw error;},validate:async()=>assert.fail(),save:()=>assert.fail()});
  await assert.rejects(images.done(),e=>e===error); assert.equal(calls,1);
});
test('external failure and expired completion never publish evidence', async () => {
  let clock=0; const g=guard();
  const images=arm({guard:g,now:()=>clock,delays:[0],deadline:10,
    capture:async()=>{clock=11;return 'late';},validate:async()=>assert.fail(),save:()=>assert.fail()});
  await assert.rejects(images.done(),/completion deadline/);
  const h=guard(), error=Error('terminal');h.fail(error);
  const other=arm({guard:h,delays:[0],deadline:Date.now()+1000,
    capture:async()=>assert.fail(),validate:async()=>assert.fail(),save:()=>assert.fail()});
  await assert.rejects(other.done(),e=>e===error);
});
