'use strict';
// Mock the whole outer controller, including asynchronous child completion.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { EventEmitter } = require('node:events');
const source = fs.readFileSync(require.resolve('./dungeon-siege-seh-controls'), 'utf8');
(async () => {
  for (const mode of ['pass', 'msvc', 'child-failure', 'disk', 'deadline', 'log', 'aggregate', 'render-output']) {
    const writes = new Map(), launches = [], kills = [], timers = new Set();
    let now = 0, disk = 4 * 1024 ** 3, generated = false;
    const root = '/tmp/wa-recovery-20261014', out = '/home/user/wine-assembly/scratch/runs/20261019-dungeon-siege-seh-mock';
    const fakeFs = {
      existsSync: p => p !== out || generated, statSync: () => ({ isFile: () => true }), readFileSync: () => Buffer.from('pin'),
      readdirSync: p => generated && ((mode === 'aggregate' && p === out) || (mode === 'render-output' && p === root + '/test/output')) ? [{ name: 'large' }] : [],
      lstatSync: () => ({ isDirectory: () => false, size: 32 * 1024 ** 2 + 1 }),
      statfsSync: () => ({ bavail: disk, bsize: 1 }), mkdirSync() {}, copyFileSync() {},
      writeFileSync: (p, v) => { assert(!writes.has(p)); writes.set(p, v); },
      openSync: () => 1, writeSync() {}, closeSync() {},
    };
    const fakeCp = {
      execFileSync: command => command === 'git' ? '' : JSON.stringify({ ready: true, admissionBytes: 2852126720, hardFloorBytes: 2214592512 }),
      spawn: (command, args, options) => {
        launches.push({ args, options });
        const child = new EventEmitter(); child.pid = 100 + launches.length;
        child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
        setImmediate(() => {
          generated = true;
          if (mode === 'disk') disk = 2214592512;
          if (mode === 'deadline') now = 180001;
          if (mode === 'log') child.stdout.emit('data', Buffer.alloc(4 * 1024 ** 2 + 1));
          for (const tick of timers) tick();
          child.emit('close', mode === 'child-failure' ? 1 : 0, null);
        });
        return child;
      },
    };
    const fakeProcess = { argv: ['node', 'controller', '20261019-dungeon-siege-seh-mock', ...(mode === 'msvc' ? ['--msvc'] : [])], execPath: 'node',
      env: { NODE_OPTIONS: 'bad', WA_FAKE: 'bad', PATH: '/bin' }, on() {}, exit() {},
      kill: (pid, signal) => { if (signal === 0) throw Object.assign(new Error('absent'), { code: 'ESRCH' }); kills.push(pid); },
    };
    class Clock extends Date { static now() { return now; } }
    const requireMock = n => n === 'node:fs' ? fakeFs : n === 'node:child_process' ? fakeCp : require(n);
    vm.runInNewContext(source, { require: requireMock, __dirname: root + '/tools', __filename: root + '/tools/controller.js', process: fakeProcess,
      console: { log() {}, error() {} }, Date: Clock,
      setInterval: f => { timers.add(f); return f; }, clearInterval: f => timers.delete(f), setTimeout });
    for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(launches.length, mode === 'msvc' ? 2 : mode === 'pass' ? 4 : 1, 'Stop at first failed job');
    assert(launches.every(l => l.options.detached && !l.options.env.NODE_OPTIONS && !l.options.env.WA_FAKE));
    if (mode === 'msvc') {
      assert.deepEqual(launches.map(l => Array.from(l.args)), [
        [root + '/tools/dungeon-siege-msvc-seh-fixture.js', '--root=' + root],
        [root + '/tools/dungeon-siege-msvc-seh-fixture.js', '--root=' + root, '--compat']]);
      assert(writes.has(out + '/complete.json'));
    } else if (mode === 'pass') {
      assert.deepEqual(launches.map(l => Array.from(l.args)), [
        ['test/test-fault-reserved-sync.js'], ['test/test-fault-reserved-sync.js', '--compat'],
        ['test/test-fault-reserved-page-cross.js'], ['test/test-fault-reserved-page-cross.js', '--compat']]);
      assert(writes.has(out + '/complete.json'));
    } else {
      assert(writes.has(out + '/failure.json'));
      if (mode !== 'child-failure') assert(kills.includes(-101), 'Guard kills the child process group');
    }
  }
  console.log('PASS: four dispatch controls, first-failure stop, disk/deadline/log/aggregate/render-output group guards, sanitized environment.');
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
