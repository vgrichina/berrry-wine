'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// Run-helper admission only. These predicates never call or write the guest.
function title(main) {
  assert(main?.running === true && main.frozen?.frozen === true && main.frozen.hosts === 1,
    'stable single frozen host required');
  const n = main.nativeSelection;
  assert(n?.available === true, 'native title unavailable');
  for (const [key, tag, value] of [['file', -2, 'startscreen'], ['conscheme', -2, 'title'],
    ['newconscheme', -6, null], ['showmenu', -1, 0]])
    assert(n[key]?.tag === tag && n[key].value === value, 'original title required: ' + key);
  const o = n.opening, c = o?.cancel;
  assert(o?.version === 'mdk2-title-opening-v1', 'opening observer required');
  assert(c?.binding === 1 && c.secondary === -1 && c.flags === 4 && c.fall === 4,
    'original Escape binding required');
  assert([c.previous, c.raw].every(v => Number.isFinite(v) && v >= 0) &&
    [0, 1].includes(c.active), 'invalid cancel sample');
  for (const key of ['cancelFunction', 'buttonTimerFunction', 'titleCancelHandler'])
    assert(o[key]?.tag === -4 && Number.isInteger(o[key].value) && o[key].value >= 0x400000,
      'original callback identity required');
  assert(Number.isInteger(n.state) && Number.isInteger(n.level), 'Lua identity required');
  return n;
}
function sameTitle(before, after, events) {
  const a = title(before), b = title(after);
  assert(after.frozen.steps >= before.frozen.steps, 'nonmonotonic title sample');
  for (const k of ['state', 'level']) assert.equal(b[k], a[k], 'title identity changed');
  for (const k of ['entry', 'index', 'binding', 'secondary', 'flags', 'fall'])
    assert.equal(b.opening.cancel[k], a.opening.cancel[k], 'cancel identity changed');
  for (const k of ['cancelFunction', 'buttonTimerFunction', 'titleCancelHandler'])
    assert.deepEqual(b.opening[k], a.opening[k], 'callback identity changed');
  assert.deepEqual(after.observation?.inputs, events, 'input during Escape observation');
  return b;
}
function drained(main) {
  return Array.isArray(main.inputQueue) && main.inputQueue.length === 0 &&
    Object.hasOwn(main, 'activeInput') && main.activeInput === null && main.mouseButtonsMask === 0;
}
function pressed(before, after, events) {
  const n = sameTitle(before, after, events), c = n.opening.cancel, l = n.opening.inputList;
  assert(l && Number.isInteger(l.count) && l.count === l.entries.length, 'native list required');
  // A trusted DOM edge or an empty queue alone cannot stand in for this poll.
  return drained(after) && c.raw === 1 && c.previous === 1 && l.count === 1 &&
    l.entries[0].binding === 1 && l.entries[0].value === 1 && l.entries[0].extra === 0;
}
function released(before, after, events) {
  const n = sameTitle(before, after, events), c = n.opening.cancel;
  return drained(after) && c.raw === 0 && c.previous === 0 && c.active === 0;
}

// Adapt the exact previously executed helper; leave its ACK, inspection, ledger,
// one-shot, step/command bounds, absolute deadline and failure latch intact.
// Caller compiles with the predecessor filename so its unchanged imports resolve.
function repairSource(source) {
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),
    '1e657ce9e2d29e1dc5577b3e1d5b39e18ccfda21edec18d4267dcac321db3bed', 'unexpected original menu helper');
  const replace = (old, next) => {
    assert.equal(source.split(old).length, 2, 'unique original helper boundary');
    source = source.replace(old, next);
  };
  replace("const fs = require('node:fs');",
    "const fs = require('node:fs');\nconst readiness = require(" + JSON.stringify(__filename) + ');');
  replace("if(phase==='open')openingReady(main);", "if(phase==='open'){readiness.title(main);openingReady(main);}");
  replace("if(phase==='open')openingReady(current);", "if(phase==='open'){readiness.title(current);openingReady(current);}");
  replace("await send({action:'step',n:16});\n        await send({action:'state',name:name+'-escape-positive'});", `for(;;){
          await send({action:'step',n:16});
          const probe=name+'-escape-positive-'+ledger.commands;
          await send({action:'state',name:probe});
          const sample=read(path.join(dir,probe+'.json'));
          if(readiness.pressed(current,sample.main,downEvents)){
            write(path.join(dir,name+'-escape-positive.json'),sample);break;
          }
        }`);
  replace("await send({action:'step',n:32});\n        await send({action:'state',name:name+'-escape-rest'});", `let first=true;
        for(;;){
          await send({action:'step',n:first?32:16});first=false;
          const probe=name+'-escape-rest-'+ledger.commands;
          await send({action:'state',name:probe});
          const sample=read(path.join(dir,probe+'.json'));
          if(readiness.released(current,sample.main,upEvents)){
            write(path.join(dir,name+'-escape-rest.json'),sample);break;
          }
        }`);
  return source;
}
module.exports = {title, pressed, released, repairSource};
