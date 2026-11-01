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
    const orderedExe = path.join(dir, 'ordered.com');
    // BIOS consumes each key, writes it to consecutive guest memory, and
    // displays it. The second capture must contain only the first answer.
    const loop = [0xB4, 1, 0xCD, 0x16, 0x74, 0xFA, 0xB4, 0, 0xCD, 0x16,
      0x88, 0x04, 0x46, 0xFE, 0x06, 0, 2, 0xB4, 0x0E, 0xCD, 0x10];
    fs.writeFileSync(orderedExe, Buffer.from([0xBE, 1, 2, ...loop, 0xEB, 256 - loop.length - 2]));
    const images = [path.join(dir, 'first.png'), path.join(dir, 'second.png')];
    const seen = [];
    const ordered = await runDos({ ...opts, exe: orderedExe, checkpoints: [1000, 10000].map((at, i) => ({
      at, png: images[i], pause: async (snapshot, signal) => {
        assert.strictEqual(snapshot.index, i);
        assert.strictEqual(snapshot.at, at);
        assert.strictEqual(signal.aborted, false);
        assert.strictEqual(snapshot.text.includes('a'), i === 1);
        assert(!snapshot.text.includes('b'));
        assert(fs.existsSync(images[i]));
        seen.push(snapshot.dispatched);
        await new Promise(resolve => setTimeout(resolve, 10));
        return ['a', 'b'][i];
      },
    })) });
    const orderedData = r => Array.from(r.vm.mem.subarray((r.vm.get('ds') << 4) + 0x200,
      (r.vm.get('ds') << 4) + 0x203));
    // parseKeys letters retain their requested ASCII case.
    assert.deepStrictEqual(orderedData(ordered), [2, 97, 98]);
    assert.strictEqual(ordered.checkpoints.length, 2);
    assert.strictEqual(ordered.checkpoint, ordered.checkpoints[0]);
    assert(seen[1] > seen[0]);
    assert(ordered.dispatched >= opts.budget && ordered.dispatched < opts.budget + 16);
    assert.strictEqual(ordered.machine.keys.length, 0);
    assert.deepStrictEqual(ordered.machine.kbQueue, [0x1e, 0x9e, 0x30, 0xb0]);
    assert(!fs.readFileSync(images[0]).equals(fs.readFileSync(images[1])));
    const emptySequence = await runDos({ ...opts, checkpoints: [] });
    const noSequenceInput = await runDos({ ...opts,
      checkpoints: [1000, 10000].map(at => ({ at, pause: () => '' })) });
    for (const r of [emptySequence, noSequenceInput]) {
      assert.deepStrictEqual(data(r), data(plain));
      assert.strictEqual(r.dispatched, plain.dispatched);
      assert.strictEqual(r.handbacks, plain.handbacks);
      for (const reg of ['ax', 'bx', 'cx', 'dx', 'cs', 'ip', 'ds', 'sp'])
        assert.strictEqual(r.vm.get(reg), plain.vm.get(reg), reg);
    }
    const unreachable = () => { throw new Error('later pause must not run'); };
    const sequenceStop = await runDos({ ...opts, checkpoints: [
      { at: 1000, pause: () => '' }, { at: 2000, pause: () => null },
      { at: 3000, pause: unreachable },
    ] });
    assert.strictEqual(sequenceStop.checkpoints.length, 2);
    assert(sequenceStop.checkpoints[1].stopped);
    const lateError = new Error('second callback failed');
    await assert.rejects(runDos({ ...opts, checkpoints: [
      { at: 0, pause: () => '' }, { at: 1000, pause: () => { throw lateError; } },
      { at: 2000, pause: unreachable },
    ] }), e => e === lateError);
    for (const ats of [[1000, 1000], [2000, 1000], [-1], [opts.budget], [Infinity], [NaN]]) {
      await assert.rejects(runDos({ ...opts,
        checkpoints: ats.map(at => ({ at, pause: () => '' })) }), /checkpoint requires/);
    }
    await assert.rejects(runDos({ ...opts, checkpoints: Array(65).fill({ at: 0, pause() {} }) }), /at most 64/);
    await assert.rejects(runDos({ ...opts, checkpoints: {}, }), /array/);
    await assert.rejects(runDos({ ...opts, checkpoint: { at: 0, pause() {} }, checkpoints: [] }), /not both/);
    // Two thresholds crossed by one guest handback still capture in order.
    const crossed = await runDos({ ...opts, checkpoints: [1, 2].map(at => ({ at, pause: () => '' })) });
    assert.strictEqual(crossed.checkpoints.length, 2);
    assert.strictEqual(crossed.checkpoints[0].dispatched, crossed.checkpoints[1].dispatched);
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
    let sequenceSignal;
    const sequenceTimed = await runDos({ ...opts, seconds: 0.15, checkpoints: [
      { at: 0, pause: () => new Promise(resolve => setTimeout(() => resolve(''), 40)) },
      { at: 1000, pause: (_, s) => { sequenceSignal = s; return new Promise(() => {}); } },
      { at: 2000, pause: unreachable },
    ] });
    assert(sequenceTimed.ranOutOfTime);
    assert(sequenceSignal.aborted);
    assert.strictEqual(sequenceTimed.checkpoints.length, 2);
    assert(sequenceTimed.secs < 1);
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
    // Parent deliberately keeps its pipe open after every answer. Natural
    // exit must drain output and preserve unrelated pending work.
    async function heldOpen(executable, answers, extra = [], nodeArgs = []) {
      return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [...nodeArgs, path.join(__dirname, '../tools/toyvm/run-dos.js'),
          executable, '--dispatches=20000', '--seconds=1', '--report', '--text',
          '--checkpoint=1000', ...(answers.length > 1 ? ['--checkpoint=10000'] : []), ...extra]);
        let stdout = '', stderr = '', sent = 0;
        child.stdout.on('data', b => {
          stdout += b;
          const prompts = (stdout.match(/EOF to stop/g) || []).length;
          if (prompts > sent) {
            assert.strictEqual(prompts, sent + 1);
            const line = stdout.split('\n').filter(s => s.startsWith('checkpoint '))[sent];
            const snapshot = JSON.parse(line.slice('checkpoint '.length).split('; enter')[0]);
            assert.strictEqual(snapshot.index, sent);
            if (snapshot.png) {
              assert(fs.existsSync(snapshot.png));
              assert.strictEqual(PNG.sync.read(fs.readFileSync(snapshot.png)).width, 640);
              assert.strictEqual(snapshot.text.includes('a'), sent === 1);
              assert(!snapshot.text.includes('b'));
            }
            const answer = answers[sent++];
            if (answer === null) child.stdin.end();
            else setTimeout(() => child.stdin.write(answer + '\n'), 20);
          }
        });
        child.stderr.on('data', b => { stderr += b; });
        const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
        child.once('error', reject);
        child.once('close', (code, signal) => {
          clearTimeout(timer);
          try {
            assert.strictEqual(signal, null, stdout + stderr);
            assert.strictEqual(code, 0, stdout + stderr);
            assert.strictEqual(sent, answers.length, stdout);
            if (!answers.includes(null)) assert.strictEqual(child.stdin.writableEnded, false);
            resolve(stdout);
          } catch (error) { reject(error); }
        });
      });
    }
    assert((await heldOpen(cliExe, ['enter'])).includes('exited=true code=0'));
    const marker = path.join(dir, 'pending-work.txt');
    const preload = path.join(dir, 'pending-work.cjs');
    fs.writeFileSync(preload, `process.stdin.once('data', () => setTimeout(() => require('fs').writeFileSync(${JSON.stringify(marker)}, 'drained'), 250));`);
    await heldOpen(cliExe, ['enter'], [], ['--require', preload]);
    assert.strictEqual(fs.readFileSync(marker, 'utf8'), 'drained');
    // Exit only after the second real BIOS read.
    const twoExe = path.join(dir, 'two.com');
    const twoLoop = [...loop, 0x80, 0x3E, 0, 2, 2]; // cmp byte [0200],2
    fs.writeFileSync(twoExe, Buffer.from([0xBE, 1, 2, ...twoLoop,
      0x75, 256 - twoLoop.length - 2, 0xB8, 0, 0x4C, 0xCD, 0x21]));
    const cliImages = [path.join(dir, 'cli-first.png'), path.join(dir, 'cli-second.png')];
    const twoOutput = await heldOpen(twoExe, ['a', 'b'], cliImages.map(png => '--checkpoint-png=' + png));
    assert(!fs.readFileSync(cliImages[0]).equals(fs.readFileSync(cliImages[1])));
    assert(twoOutput.includes('|ab'), twoOutput);
    assert(twoOutput.includes('exited=true code=0'), twoOutput);
    const secondEof = await heldOpen(twoExe, ['a', null]);
    assert(secondEof.includes('|a'), secondEof);
    assert(!secondEof.includes('|ab'), secondEof);
    assert(secondEof.includes('exited=false'), secondEof);
    const fixedTwo = spawnSync(process.execPath, [path.join(__dirname, '../tools/toyvm/run-dos.js'),
      twoExe, '--dispatches=20000', '--seconds=5', '--checkpoint=1000', '--checkpoint=10000',
      '--checkpoint-keys=a', '--checkpoint-keys=b', '--text'], { encoding: 'utf8', timeout: 15000 });
    assert.ifError(fixedTwo.error);
    assert.strictEqual(fixedTwo.status, 0, fixedTwo.stderr);
    assert(fixedTwo.stdout.includes('|ab'), fixedTwo.stdout);
    const badCli = spawnSync(process.execPath, [path.join(__dirname, '../tools/toyvm/run-dos.js'),
      twoExe, '--checkpoint=1000', '--checkpoint=10000', '--checkpoint-keys=a'],
    { encoding: 'utf8', timeout: 15000 });
    assert.strictEqual(badCli.status, 1);
    assert(badCli.stderr.includes('once per --checkpoint'));
    await assert.rejects(runDos({ ...opts, seconds: 0,
      checkpoint: { at: 1, pause: () => 'enter' } }), /checkpoint requires/);
    console.log('runner successive checkpoints/held-open answered stdin: order, BIOS consumption, no premature taps, sequence bounds/EOF/deadline/errors PASS; legacy checkpoint: timing, text/VESA pixels, one tap, same-session bounds, no-input equivalence, stop, deadline, terminal, callback errors, CLI keys/EOF and defaults PASS');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
