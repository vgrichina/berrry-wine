'use strict';

// A real COM keyboard poll loop: count reads at DS:0200 and save AL at 0201.
// A premature, repeated, or missing tap changes guest memory, not just a log.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const { PNG } = require('pngjs');
const { runDos } = require('../tools/toyvm/run-dos');
const { rgbaConsole, rgbaFrame } = require('../tools/toyvm/framebuffer');
const { readStrikes, pickStrike } = require('../tools/fnt-read');

function checkPng(file, expected) {
  const actual = PNG.sync.read(fs.readFileSync(file));
  assert.strictEqual(actual.width, expected.width);
  assert.strictEqual(actual.height, expected.height);
  assert.deepStrictEqual(actual.data, Buffer.from(expected.rgba));
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-checkpoint-'));
  try {
    const exe = path.join(dir, 'poll.com');
    fs.writeFileSync(exe, Buffer.from([
      0xB8, 0x58, 0x0E, 0xCD, 0x10,       // visible text X, before polling
      0xB4, 0x01, 0xCD, 0x16, 0x74, 0xFA, // poll, jz poll
      0xB4, 0x00, 0xCD, 0x16,             // read
      0xFE, 0x06, 0x00, 0x02,             // inc byte [0200]
      0xA2, 0x01, 0x02, 0xEB, 0xED,       // mov [0201],al; jmp poll
    ]));
    const opts = { exe, budget: 20000, slice: 1000, seconds: 5, stuckLimit: 0 };
    const data = r => [...r.vm.mem.subarray((r.vm.get('ds') << 4) + 0x200,
      (r.vm.get('ds') << 4) + 0x202)];
    const plain = await runDos(opts);
    assert.deepStrictEqual(data(plain), [0, 0]);
    assert.strictEqual(plain.checkpoint, null);
    const png = path.join(dir, 'before.png');
    let calls = 0;
    const tapped = await runDos({ ...opts, checkpoint: {
      at: 1000, png, pause: async (snapshot, signal) => {
        calls++;
        assert(Object.isFrozen(snapshot));
        assert(snapshot.dispatched >= 1000 && snapshot.dispatched < opts.budget);
        assert.strictEqual(snapshot.delivered, false);
        assert.strictEqual(signal.aborted, false);
        assert.strictEqual(snapshot.surface.text, true);
        assert(snapshot.text.includes('X'));
        assert(fs.readFileSync(png).subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')));
        await new Promise(resolve => setTimeout(resolve, 15));
        return 'enter';
      },
    } });
    assert.strictEqual(calls, 1);
    assert.deepStrictEqual(data(tapped), [1, 13]);
    assert.strictEqual(tapped.checkpoint.delivered, true);
    assert.deepStrictEqual(tapped.checkpoint.keys, [{ ah: 0x1c, al: 13 }]);
    assert.strictEqual(tapped.machine.keys.length, 0);
    assert.deepStrictEqual(tapped.machine.kbQueue, [0x1c, 0x9c]);
    // DosSession tests the budget at a block transfer. This fixture's longest
    // straight-line path has fewer than eight dispatches, so its final block
    // may overshoot by that much. Enter takes a different path through it;
    // it must spend the SAME session budget, never a new post-pause budget.
    assert(tapped.dispatched >= opts.budget && tapped.dispatched <= opts.budget + 8);
    assert.strictEqual(tapped.ranOutOfTime, false);
    checkPng(png, rgbaConsole(tapped.machine.con,
      pickStrike(readStrikes(path.join(__dirname, '../fonts/Terminal.fon')), 12)));
    const noKeys = await runDos({ ...opts, checkpoint: { at: 1000, pause: () => '' } });
    assert.deepStrictEqual(data(noKeys), data(plain));
    assert.strictEqual(noKeys.dispatched, plain.dispatched);
    assert.strictEqual(noKeys.handbacks, plain.handbacks);
    for (const reg of ['ax', 'bx', 'cx', 'dx', 'cs', 'ip', 'ds', 'sp']) {
      assert.strictEqual(noKeys.vm.get(reg), plain.vm.get(reg), reg);
    }
    const stopped = await runDos({ ...opts, checkpoint: { at: 1000, pause: () => null } });
    assert(stopped.dispatched < opts.budget);
    assert.deepStrictEqual(data(stopped), [0, 0]);
    assert.strictEqual(stopped.checkpoint.stopped, true);
    assert.strictEqual(stopped.dispatched, stopped.checkpoint.dispatched);
    let signal;
    const timed = await runDos({ ...opts, seconds: 0.05,
      checkpoint: { at: 0, pause: (_, s) => { signal = s; return new Promise(() => {}); } } });
    assert.strictEqual(timed.ranOutOfTime, true);
    assert.strictEqual(timed.dispatched, 0);
    assert.strictEqual(timed.checkpoint.delivered, false);
    assert.strictEqual(signal.aborted, true);
    const graphics = path.join(dir, 'graphics.com');
    fs.writeFileSync(graphics, Buffer.from([
      0xB8, 0x02, 0x4F, 0xBB, 0x01, 0x01, 0xCD, 0x10, // VESA 101h
      0xB8, 0x00, 0xA0, 0x8E, 0xC0,                   // es=A000
      0x26, 0xC6, 0x06, 0x00, 0x00, 0x01, 0xEB, 0xFE, // pixel 0=blue; loop
    ]));
    const graphicsPng = path.join(dir, 'graphics.png');
    const gr = await runDos({ ...opts, exe: graphics, checkpoint: {
      at: 1000, png: graphicsPng, pause: snapshot => {
        assert.strictEqual(snapshot.surface.text, false);
        assert.strictEqual(snapshot.surface.geom.width, 640);
        assert.strictEqual(snapshot.surface.geom.height, 480);
        return null;
      },
    } });
    const expected = rgbaFrame(gr.vm.mem, gr.machine.palette, gr.checkpoint.surface.geom);
    assert.deepStrictEqual([...expected.rgba.subarray(0, 4)], [0, 0, 170, 255]);
    checkPng(graphicsPng, expected);
    const terminal = path.join(dir, 'exit.com');
    fs.writeFileSync(terminal, Buffer.from([0xB8, 0x07, 0x4C, 0xCD, 0x21]));
    const ended = await runDos({ ...opts, exe: terminal, checkpoint: {
      at: 1000, pause: () => { throw new Error('terminal callback must not run'); },
    } });
    assert.strictEqual(ended.machine.exitCode, 7);
    assert.strictEqual(ended.machine.exited, true);
    assert.strictEqual(ended.checkpoint, null);
    let errorSignal;
    const callbackError = new Error('callback failure');
    await assert.rejects(runDos({ ...opts, checkpoint: { at: 0,
      pause: (_, s) => { errorSignal = s; throw callbackError; },
    } }), e => e === callbackError);
    assert.strictEqual(errorSignal.aborted, true);
    await assert.rejects(runDos({ ...opts, checkpoint: { at: 0,
      pause: async () => { throw callbackError; },
    } }), e => e === callbackError);
    await assert.rejects(runDos({ ...opts, checkpoint: { at: 0, pause: () => 42 } }),
      /key string or null/);
    const cliExe = path.join(dir, 'cli.com');
    fs.writeFileSync(cliExe, Buffer.from([
      0xB4, 0x01, 0xCD, 0x16, 0x74, 0xFA, // wait
      0xB4, 0x00, 0xCD, 0x16,             // consume key
      0xB8, 0x4B, 0x0E, 0xCD, 0x10,       // print K
      0xB8, 0x00, 0x4C, 0xCD, 0x21,       // exit
    ]));
    const cli = (input, ...args) => {
      const r = spawnSync(process.execPath, [path.join(__dirname, '../tools/toyvm/run-dos.js'),
        cliExe, '--dispatches=20000', '--slice=1000', '--seconds=5', '--checkpoint=1000',
        '--text', '--report', ...args],
      { input, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
      assert.ifError(r.error);
      assert.strictEqual(r.status, 0, r.stderr + r.stdout);
      assert.strictEqual((r.stdout.match(/^checkpoint /gm) || []).length, 1);
      return r.stdout;
    };
    for (const output of [cli('', '--checkpoint-keys=enter'), cli('enter\n')]) {
      assert(output.includes('|K'), output);
      assert(output.includes('exited=true code=0'), output);
    }
    const eof = cli('');
    assert(eof.includes('EOF to stop'));
    assert(!eof.includes('|K'), eof);
    assert(eof.includes('exited=false'), eof);
    // Keep stdin open: the wall deadline must close readline and let the CLI
    // exit by itself, even when there is neither an answer nor EOF.
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(__dirname, '../tools/toyvm/run-dos.js'),
        cliExe, '--dispatches=20000', '--seconds=0.05', '--checkpoint=0']);
      let output = '';
      child.stdout.on('data', b => { output += b; });
      child.stderr.on('data', b => { output += b; });
      const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
      child.once('error', reject);
      child.once('close', (code, signal) => {
        clearTimeout(timer);
        try {
          assert.strictEqual(signal, null, output);
          assert.strictEqual(code, 0, output);
          assert(output.includes('out of time'), output);
          resolve();
        } catch (e) { reject(e); }
      });
    });
    await assert.rejects(runDos({ ...opts, seconds: 0,
      checkpoint: { at: 1, pause: () => 'enter' } }), /checkpoint requires/);
    console.log('runner checkpoint: timing, text/VESA pixels, one tap, same-session bounds, no-input equivalence, stop, deadline, terminal, callback errors, CLI keys/EOF and defaults PASS');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
