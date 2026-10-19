'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), { EventEmitter } = require('node:events');
const { limits } = require('./dungeon-siege-observer-plan');
const source = fs.readFileSync(require.resolve('./dungeon-siege-observer-controls'), 'utf8');
(async () => {
  for (const mode of ['pass', 'child-failure', 'disk', 'deadline', 'log', 'evidence', 'build-growth', 'pins', 'admission', 'no-grant', 'lease-busy']) {
    const root = '/candidate', out = '/home/user/wine-assembly/scratch/runs/20261019-dungeon-siege-observer-controls-mock';
    const plan = { version: 1, source: 'a'.repeat(40), root, limits }, writes = new Map(), launches = [], kills = [], timers = new Set();
    let generated = false, created = false, now = 0, lease = null, released = false, disk = mode === 'admission' ? limits.admissionBytes : 4 * 1024 ** 3;
    const fakeFs = {
      constants: { COPYFILE_EXCL: 1 }, existsSync: p => p.endsWith('runtime.lock') ? lease !== null : p === out ? created : p === root + '/build' || p.endsWith('.wasm'),
      statSync: () => ({ size: 2 * 1024 ** 2 }),
      realpathSync: () => '/tmp/wa-dungeon-thread-oct19',
      readFileSync: p => p.endsWith('runtime.lock') ? lease : p === '/plan.json' ? JSON.stringify(plan) : Buffer.from('pin'), statfsSync: () => ({ bavail: disk, bsize: 1 }),
      readdirSync: p => generated && ((mode === 'evidence' && p === out) || (mode === 'build-growth' && p === root + '/build')) ? [{ name: 'large' }] : [],
      lstatSync: () => ({ isDirectory: () => false, blocks: (mode === 'build-growth' ? limits.buildGrowthBytes : limits.evidenceBytes) / 512 + 1 }),
      mkdirSync: p => { if (p === out) created = true; }, copyFileSync() {},
      openSync: p => { if (p.endsWith('runtime.lock')) { if (mode === 'lease-busy') throw Error('lease exists'); return 99; } return 1; },
      writeSync: (fd, text) => { if (fd === 99) lease = text; }, closeSync() {}, unlinkSync: () => { released = true; lease = null; },
      writeFileSync: (p, text) => { assert(!writes.has(p)); writes.set(p, JSON.parse(text)); },
    };
    const fakeCp = { spawn(command, args, options) {
      launches.push({ command, args, options }); const child = new EventEmitter(); child.pid = 100 + launches.length;
      child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      setImmediate(() => {
        generated = true;
        if (mode === 'disk') disk = limits.hardFloorBytes;
        if (mode === 'deadline') now = limits.jobMs;
        if (mode === 'log') child.stdout.emit('data', Buffer.alloc(limits.logBytes + 1));
        for (const tick of timers) tick();
        child.emit('close', mode === 'child-failure' ? 1 : 0, null);
      }); return child;
    } };
    const processMock = { argv: ['node', 'controller', '/plan.json', '20261019-dungeon-siege-observer-controls-mock'], execPath: 'node',
      env: { WA_DUNGEON_OBSERVER_GRANT: mode === 'no-grant' ? '' : '20261019-dungeon-siege-observer-controls-mock', WA_BAD: '1', NODE_OPTIONS: 'bad', PATH: '/bin' }, on() {}, exit() {},
      kill(pid, signal) { if (signal === 0) throw Object.assign(Error('absent'), { code: 'ESRCH' }); kills.push(pid); } };
    class Clock extends Date { static now() { return now; } }
    const requireMock = name => name === 'node:fs' ? fakeFs : name === 'node:child_process' ? fakeCp : name === './dungeon-siege-observer-plan' ? {
      sha: () => 'pin', verifyPlan: () => { if (mode === 'pins' && generated) throw Error('changed pin'); },
    } : require(name);
    const execute = () => vm.runInNewContext(source, { require: requireMock, __filename: root + '/tools/dungeon-siege-observer-controls.js', process: processMock,
      console: { log() {}, error() {} }, Date: Clock, setInterval: f => { timers.add(f); return f; }, clearInterval: f => timers.delete(f), setTimeout });
    if (['admission', 'no-grant', 'lease-busy'].includes(mode)) { assert.throws(execute, mode === 'admission' ? /admission/ : mode === 'no-grant' ? /grant token/ : /lease exists/); assert.equal(launches.length, 0); assert.equal(created, false); assert.equal(released, false); continue; }
    execute(); for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(launches.length, mode === 'pass' ? 7 : 1);
    assert(released, 'Release own lease after terminal cleanup');
    assert.equal(launches[0].command, 'bash'); assert.equal(launches[0].args[0], 'tools/build.sh');
    assert(launches.every(l => l.options.detached && !l.options.env.WA_BAD && !l.options.env.NODE_OPTIONS));
    if (mode === 'pass') {
      const q = writes.get(out + '/qualification.json'); assert(q); assert.equal(q.results.length, 7);
      assert(launches[1].args.includes('--observe')); assert(launches[2].args.includes('--compat'));
      assert(writes.has(out + '/prior-modules.json'));
    } else {
      assert(writes.has(out + '/failure.json')); assert(!writes.has(out + '/qualification.json'));
      if (!['child-failure', 'pins'].includes(mode)) assert(kills.includes(-101));
    }
  }
  console.log('PASS observer controller: normal build + six native jobs, admission, source pins, disk/deadline/log/evidence/build-growth stops, no retries.');
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
