'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {operate} = require('./revolt-operator-command.cjs');
const {publishJSON} = require('./atomic-command-publication.js');

function directory(t) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'revolt-command-'));
  t.after(() => fs.rmSync(out, {recursive:true, force:true}));
  return out;
}

test('operator never exposes its final command during the incomplete write', async t => {
  const out = directory(t), write = fs.writeFileSync;
  const command = {action:'gesture', keys:['ArrowUp','ArrowRight'], review:'fresh-whole-frame', ms:1000};
  fs.writeFileSync = function(fd, bytes, ...args) {
    if (typeof fd === 'number') {
      assert(!fs.existsSync(path.join(out, 'command-0.json')), 'consumer cannot see incomplete JSON');
      assert(fs.readdirSync(out).some(n => n.endsWith('.tmp')));
    }
    return write.call(this, fd, bytes, ...args);
  };
  let pending;
  try { pending = operate(out, command); } finally { fs.writeFileSync = write; }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'command-0.json'))), command);
  publishJSON(path.join(out, 'receipt-0.json'), {state:'ACK'});
  assert.deepEqual(await pending, {state:'ACK'});
  assert(!fs.readdirSync(out).some(n => n.endsWith('.tmp')));
});

test('permanent UNKNOWN prevents publication; an in-flight closure does not retry', async t => {
  const out = directory(t);
  publishJSON(path.join(out, 'UNKNOWN.json'), {reason:'closed'});
  await assert.rejects(operate(out, {action:'capture'}), /closed UNKNOWN/);
  assert.deepEqual(fs.readdirSync(out), ['UNKNOWN.json']);
  const active = directory(t), pending = operate(active, {action:'capture'});
  publishJSON(path.join(active, 'UNKNOWN.json'), {reason:'closed'});
  await assert.rejects(pending, /closed UNKNOWN/);
  assert(!fs.existsSync(path.join(active, 'command-1.json')));
});
