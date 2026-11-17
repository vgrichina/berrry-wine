'use strict';
const assert = require('assert');
const {chainReviews, check, scanSources} = require('../tools/callback-ownership-census');
const entries = scanSources([{file:'src/review-fixture.wat',src:'(func $entry (global.set $eip (i32.const 1)))'}]);
const entry = entries[0], oldHash = 'a'.repeat(64), middleHash = 'b'.repeat(64);
const census = {version:1,entries:[{...entry,sha256:oldHash,kind:'callback',reason:'fixture',ownership:'pending'}]};
const base = {version:1,revisions:[{file:entry.file,name:entry.name,baseSHA256:oldHash,sha256:middleHash,reason:'earlier review'}]};
const step = {version:1,revisions:[{file:entry.file,name:entry.name,baseSHA256:middleHash,sha256:entry.sha256,reason:'current review'}]};
assert.deepStrictEqual(check(entries,census,chainReviews(base,[step])),[]);
assert.equal(base.revisions[0].sha256,middleHash,'caller registry remains untouched');
for (const mutation of [r=>r.baseSHA256=oldHash,r=>r.sha256='bad',r=>r.reason='',r=>r.ownership='covered',r=>r.name='$foreign']) {
  const bad=JSON.parse(JSON.stringify(step));mutation(bad.revisions[0]);
  assert.throws(()=>chainReviews(base,[bad]),/invalid feature review/);
}
assert.throws(()=>chainReviews(base,[{...step,revisions:[...step.revisions,...step.revisions]}]),/invalid feature review/);
const changed=[{...entry,writes:[]}];
assert(check(changed,census,chainReviews(base,[step])).some(e=>e.includes('writes')),'hash review cannot admit changed producer shape');
console.log('PASS anchored feature review chain and refusal controls');
