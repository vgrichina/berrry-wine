'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
const {fork} = require('node:child_process');
const {publishJSON, createReader} = require('../tools/atomic-json-channel.cjs');
const pause = ms => new Promise(r => setTimeout(r, ms));
if (process.argv[2] === 'reader') {
  const reader = createReader(process.argv[3]);
  let polls = 0;
  const timer = setInterval(() => {
    try {
      polls++;
      const value = reader.read(0);
      if (value) { clearInterval(timer); process.send({value, polls}); process.disconnect(); }
    } catch (e) { clearInterval(timer); process.send({error: e.message}); process.exitCode = 1; process.disconnect(); }
  }, 1);
  process.send({ready:true});
} else if (process.argv[2] === 'writer') {
  // Force real partial writes and long delays inside the EXACT real publisher.
  const original = fs.writeSync;
  const signal = new Int32Array(new SharedArrayBuffer(4));
  fs.writeSync = (fd, bytes, offset, length) => {
    const n = original(fd, bytes, offset, Math.min(length, 17));
    Atomics.wait(signal, 0, 0, 3);
    return n;
  };
  publishJSON(path.join(process.argv[3], 'command-0.json'), {id:0, text:'x'.repeat(2048)});
} else {
  (async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-json-'));
    const children = [];
    const spawn = role => {
      const child = fork(__filename, [role, dir], {stdio:['ignore','inherit','inherit','ipc']});
      child.done = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (code, signal) => code === 0 ? resolve() : reject(Error(role + ' exit ' + code + '/' + signal)));
      });
      children.push(child); return child;
    };
    try {
      const reader = spawn('reader');
      const messages = [];
      reader.on('message', v => messages.push(v));
      while (!messages.some(v => v.ready)) await pause(2);
      const writer = spawn('writer');
      let sawPending = false;
      while (writer.exitCode === null) {
        if (fs.readdirSync(dir).some(n => n.endsWith('.pending'))) sawPending = true;
        await pause(2);
      }
      await Promise.all([writer.done, reader.done]);
      assert(sawPending);
      const received = messages.find(v => v.value);
      assert(received && received.polls > 10);
      assert.deepEqual(received.value, {id:0,text:'x'.repeat(2048)});
      const final = path.join(dir,'command-0.json'), before = fs.readFileSync(final);
      assert.throws(() => publishJSON(final, {id:0,text:'replacement'}), {code:'EEXIST'});
      assert.deepEqual(fs.readFileSync(final), before);
      assert(!fs.readdirSync(dir).some(n => n.endsWith('.pending')));
      const invalid = path.join(dir,'command-3.json');
      assert.throws(() => publishJSON(invalid, undefined), /JSON value required/);
      assert(!fs.existsSync(invalid));
      // A failed flush must never expose a complete name or strand a temp.
      const sync = fs.fsyncSync;
      try {
        fs.fsyncSync = () => { throw Error('flush refused'); };
        assert.throws(() => publishJSON(invalid, {id:3}), /flush refused/);
      } finally { fs.fsyncSync = sync; }
      assert(!fs.existsSync(invalid));
      assert(!fs.readdirSync(dir).some(n => n.endsWith('.pending')));
      const r = createReader(dir);
      fs.writeFileSync(path.join(dir,'.command-1.json.abandoned.pending'), '{');
      assert.equal(r.read(1), null);
      // A deliberately malformed COMPLETE file must permanently close reading.
      fs.writeFileSync(path.join(dir,'command-1.json'), '{');
      assert.throws(() => r.read(1), SyntaxError);
      assert(r.closed);
      publishJSON(path.join(dir,'command-2.json'), {id:2});
      assert.throws(() => r.read(2), SyntaxError);
      const wrong = createReader(dir, 'reply');
      publishJSON(path.join(dir,'reply-0.json'), {id:99});
      assert.throws(() => wrong.read(0), /ID mismatch/);
      assert(wrong.closed);
      console.log('PASS actual child reader / slow chunked exact publisher; pending ignored; duplicate refuses overwrite; malformed final permanently closes; reply ID mismatch');
    } finally {
      for (const c of children) if (c.exitCode === null) c.kill();
      await Promise.allSettled(children.map(c => c.done));
      fs.rmSync(dir,{recursive:true,force:true});
    }
  })().catch(e => { console.error(e); process.exitCode = 1; });
}
