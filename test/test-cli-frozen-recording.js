#!/usr/bin/env node
// True frozen CLI control + recording, end to end. The child starts before its
// first batch, advances only on `ctl step`, stays byte/time stable while this
// driver waits, and streams the stepped renderer frames to a real MP4.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync, execFile } = require('child_process');
const assert = require('assert');
const { Worker } = require('worker_threads');
const { CliVideoRecorder } = require('../lib/cli-recorder');
const { createCanvas } = require('../lib/raster-canvas');

const ROOT = path.join(__dirname, '..');
const RUN = path.join(__dirname, 'run.js');
const CTL = path.join(ROOT, 'tools', 'ctl.js');
const EXE = path.join(__dirname, 'binaries', 'notepad.exe');
const PORT = 8207;

if (!fs.existsSync(EXE)) {
  console.log('SKIP  notepad.exe not found');
  process.exit(0);
}
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) {
  console.log('SKIP  ffmpeg not found');
  process.exit(0);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-frozen-recording-'));
const video = path.join(tmpDir, 'stepped.mp4');
const signalVideo = path.join(tmpDir, 'signal-finalized.mp4');
const png = path.join(tmpDir, 'frozen.png');
const deadline = Date.now() + 60000;
let failed = false;
let signalChild = null;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
  if (!ok) failed = true;
};

const child = spawn(process.execPath, [
  RUN, `--exe=${EXE}`, `--control=${PORT}`, '--frozen',
  '--tick-ms-per-batch=20', '--batch-size=50000', '--max-seconds=45',
  '--repaint-every=1000000',
  '--quiet-api', '--quiet-blocks', '--no-close', '--no-build',
], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
let childOut = '';
child.stdout.on('data', d => { childOut += d; });
child.stderr.on('data', d => { childOut += d; });
let childCode = null;
const childExit = new Promise(resolve => child.on('exit', code => {
  childCode = code;
  resolve(code);
}));

const ctl = (...args) => new Promise((resolve, reject) => {
  execFile(process.execPath, [CTL, `--port=${PORT}`, ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 20000,
  }, (error, stdout) => error ? reject(error) : resolve(stdout));
});
const waitFor = async (label, probe) => {
  while (Date.now() < deadline) {
    if (childCode !== null) throw new Error(`child exited ${childCode} waiting for ${label}\n${childOut.slice(-3000)}`);
    const value = await probe().catch(() => undefined);
    if (value !== undefined) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${label}\n${childOut.slice(-3000)}`);
};

// Observe the real pre-encoder file from another event loop: finish() runs a
// synchronous real ffmpeg mux and then unlinks it. No encoder or mixer mocks.
async function mixedPcmControls() {
  const mono = values => values.flatMap(v => [v, v]);
  const chunk = (samples, extra = {}) => ({ samples, sampleRate: 44100,
    channels: 1, bits: 16, guestStartMs: 0, ...extra });
  // Literal expectations use round(normalized sample * 32767). At 22050 Hz
  // the quarter-source-frame start visits 1/4,3/4,...,13/4: seven emissions.
  // At 16000 Hz the positions are 1/2 + i*160/441, i=0..8, with last-frame hold.
  const cases = [
    { name: 'wholly earlier and exact endpoint add neither PCM nor duration',
      chunks: [chunk([30000, 30000, 30000, 30000], { sampleRate: 1, guestStartMs: -5000 }),
        chunk([30000, 30000, 30000, 30000], { sampleRate: 1000, guestStartMs: -4 })], pcm: [] },
    { name: 'integer crossing joins a following positive chunk without old prefix',
      chunks: [chunk([30000, -30000, 8192, 16384], { guestStartMs: -2000 / 44100 }),
        chunk([24576], { guestStartMs: 2000 / 44100 })], pcm: mono([8192, 16384, 24575]) },
    { name: 'fractional source phase and floor emission count at 22050 Hz',
      chunks: [chunk([0, 8192, 16384, 24576], { sampleRate: 22050, guestStartMs: -250 / 22050 })],
      pcm: mono([2048, 6144, 10240, 14336, 18431, 22527, 24575]) },
    { name: 'fractional 16000 Hz stereo phase and channel separation',
      chunks: [chunk([0, 0, 8192, -8192, 16384, -16384, 24576, -24576],
        { sampleRate: 16000, channels: 2, guestStartMs: -500 / 16000 })],
      pcm: [4096, -4096, 7068, -7068, 10040, -10040, 13012, -13012,
        15984, -15984, 18956, -18956, 21928, -21928, 24575, -24575, 24575, -24575] },
    { name: 'retained suffix shorter than one output interval emits nothing',
      chunks: [chunk([30000], { sampleRate: 22050, guestStartMs: -875 / 22050 })], pcm: [] },
    { name: 'positive fractional placement, mono8 gains, overlap and clipping',
      chunks: [chunk([128, 160, 192, 224], { bits: 8, sampleRate: 22050,
        guestStartMs: 1600 / 44100, gainL: 2, gainR: 0 }),
        chunk([16384, -16384], { guestStartMs: 5000 / 44100, gainL: 1, gainR: 0.5 })],
      pcm: [0, 0, 0, 0, 0, 0, 8192, 0, 16384, 0, 32767, 8192,
        16384, -8192, 32767, 0, 32767, 0, 32767, 0] },
    { name: 'origin stereo gains and incomplete interleaved frame',
      chunks: [chunk([8192, -16384, 24576], { channels: 2, gainL: 0.5, gainR: 0.25 })],
      pcm: [4096, -4096] },
    { name: 'fractional positive audio duration ceils allocation but floors emissions',
      chunks: [chunk(Array(67).fill(8192), { sampleRate: 16000 })],
      frames: 185, pcm: mono(Array(184).fill(8192)) },
    { name: 'crossing audio duration excludes prefix and retains silent allocation tail',
      // 67.5 * 441/160 = 186.046875 output intervals remain.
      chunks: [chunk(Array(68).fill(8192), { sampleRate: 16000, guestStartMs: -500 / 16000 })],
      frames: 187, pcm: mono(Array(186).fill(8192)) },
  ];
  for (let index = 0; index < cases.length; index++) {
    const control = cases[index];
    const canvas = createCanvas(2, 2);
    const recorder = new CliVideoRecorder(canvas, {
      path: path.join(tmpDir, `pcm-${index}.mp4`), fps: 240, startGuestMs: 0,
    });
    const frames = control.frames || 184; // ceil(44100/240), one video frame
    const collector = new Worker(`
      const fs = require('fs');
      const { parentPort, workerData } = require('worker_threads');
      let fd;
      const watchdog = setTimeout(() => { throw new Error('WAV collector timed out'); }, 15000);
      const poll = setInterval(() => {
        try {
          if (fd === undefined) fd = fs.openSync(workerData.file, 'r');
          if (fs.fstatSync(fd).size !== workerData.size) return;
          const wav = Buffer.alloc(workerData.size);
          if (fs.readSync(fd, wav, 0, wav.length, 0) !== wav.length) return;
          fs.closeSync(fd);
          clearInterval(poll); clearTimeout(watchdog);
          parentPort.postMessage(wav);
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }, 1);
      parentPort.postMessage('ready');
    `, { eval: true, workerData: { file: recorder.wavPath, size: 44 + frames * 4 } });
    const ready = new Promise((resolve, reject) => {
      collector.once('message', resolve); collector.once('error', reject);
    });
    const collected = new Promise((resolve, reject) => {
      collector.on('message', value => { if (value !== 'ready') resolve(Buffer.from(value)); });
      collector.once('error', reject);
    });
    // Attach a handler immediately, including if capture or finish fails first.
    collected.catch(() => {});
    try {
      assert.strictEqual(await ready, 'ready');
      const inputs = control.chunks.map(({ samples, ...metadata }) => {
        const bytes = metadata.bits === 8 ? Buffer.from(samples) : Buffer.alloc(samples.length * 2);
        if (metadata.bits === 16) samples.forEach((sample, i) => bytes.writeInt16LE(sample, i * 2));
        const saved = Buffer.from(bytes);
        recorder.pcm({ ...metadata, bytes });
        return { bytes, saved };
      });
      await recorder.capture(canvas);
      const summary = await recorder.finish();
      const wav = await collected;
      assert.strictEqual(wav.toString('ascii', 0, 4), 'RIFF');
      assert.strictEqual(wav.readUInt32LE(4), wav.length - 8);
      assert.strictEqual(wav.toString('ascii', 8, 16), 'WAVEfmt ');
      assert.strictEqual(wav.readUInt32LE(16), 16);
      assert.strictEqual(wav.readUInt16LE(20), 1);
      assert.strictEqual(wav.readUInt16LE(22), 2);
      assert.strictEqual(wav.readUInt32LE(24), 44100);
      assert.strictEqual(wav.readUInt32LE(28), 176400);
      assert.strictEqual(wav.readUInt16LE(32), 4);
      assert.strictEqual(wav.readUInt16LE(34), 16);
      assert.strictEqual(wav.toString('ascii', 36, 40), 'data');
      assert.strictEqual(wav.readUInt32LE(40), frames * 4);
      const expected = Buffer.alloc(frames * 4);
      control.pcm.forEach((sample, i) => expected.writeInt16LE(sample, i * 2));
      assert.deepStrictEqual(wav.subarray(44), expected, control.name);
      for (const { bytes, saved } of inputs) assert.deepStrictEqual(bytes, saved);
      assert.strictEqual(summary.frames, 1);
      assert(fs.statSync(summary.path).size > 0, 'real ffmpeg mux completed');
      check(control.name, true);
    } finally {
      await collector.terminate();
      if (recorder.child.exitCode === null) recorder.child.kill('SIGKILL');
    }
  }
}

(async () => {
  await mixedPcmControls();
  await waitFor('control server', async () => childOut.includes('[control] listening') || undefined);
  const before = JSON.parse(await ctl('snapshot'));
  check('CLI starts frozen before its first batch',
    before.frozen && before.frozen.frozen === true && before.batch === 0,
    JSON.stringify(before.frozen));

  await new Promise(resolve => setTimeout(resolve, 350));
  const idle = JSON.parse(await ctl('snapshot'));
  check('wall-clock idle advances no guest batches', idle.batch === before.batch,
    `${before.batch} -> ${idle.batch}`);

  const armed = JSON.parse(await ctl('record', 'on', video, '--every=2'));
  check('direct ctl arms an MP4 recording', armed.recording === true && armed.path === video,
    JSON.stringify(armed));

  // Exercise the same recorder sink host-audio uses, without making this
  // control/recorder regression depend on a particular game's sound timing.
  await ctl('eval', `(() => {
    const frames = Math.round(44100 * 0.48);
    const bytes = Buffer.alloc(frames * 4);
    for (let i = 0; i < frames; i++) {
      const sample = Math.round(Math.sin(i * Math.PI * 2 * 440 / 44100) * 12000);
      bytes.writeInt16LE(sample, i * 4);
      bytes.writeInt16LE(sample, i * 4 + 2);
    }
    ctx.audioTap().pcm({ guestStartMs: 0, sampleRate: 44100, channels: 2,
      bits: 16, gainL: 1, gainR: 1, bytes });
    return bytes.length;
  })()`);

  const stepped = JSON.parse(await ctl('step', '24'));
  check('step waits for the requested work', stepped.steps === 24 && stepped.frozen === true,
    JSON.stringify(stepped));
  const after = JSON.parse(await ctl('snapshot'));
  await new Promise(resolve => setTimeout(resolve, 350));
  const afterIdle = JSON.parse(await ctl('snapshot'));
  check('CLI freezes again after step completes', afterIdle.batch === after.batch,
    `${after.batch} -> ${afterIdle.batch}`);
  await ctl('png', png);
  check('png captures immediately at a frozen boundary',
    fs.existsSync(png) && fs.statSync(png).size > 1000,
    fs.existsSync(png) ? `${fs.statSync(png).size} bytes` : 'missing');

  const stopped = JSON.parse(await ctl('record', 'off'));
  check('record off finalized sampled frames',
    stopped.recording === false && stopped.frames === 12 && stopped.everyNSteps === 2
      && stopped.audioChunks === 1 && stopped.audioPeak > 0.1,
    JSON.stringify(stopped));
  check('recorded MP4 exists', fs.existsSync(video) && fs.statSync(video).size > 1000,
    fs.existsSync(video) ? `${fs.statSync(video).size} bytes` : 'missing');
  const streams = spawnSync('ffprobe', ['-v', 'error', '-show_entries',
    'stream=codec_type,codec_name', '-of', 'json', video], { encoding: 'utf8' });
  const streamJson = streams.status === 0 ? JSON.parse(streams.stdout) : { streams: [] };
  check('recorded MP4 contains video and audio streams',
    streamJson.streams.some(s => s.codec_type === 'video' && s.codec_name === 'h264')
      && streamJson.streams.some(s => s.codec_type === 'audio' && s.codec_name === 'aac'),
    streams.stderr || streams.stdout);
  const frameMd5 = spawnSync('ffmpeg', ['-v', 'error', '-i', video,
    '-map', '0:v:0', '-f', 'framemd5', 'pipe:1'], { encoding: 'utf8' });
  const uniqueFrames = new Set((frameMd5.stdout || '').split('\n')
    .filter(line => /^\d+,/.test(line)).map(line => line.split(',').pop().trim()));
  check('recording forces fresh composites despite sparse repaint cadence',
    frameMd5.status === 0 && uniqueFrames.size > 1,
    `ffmpeg=${frameMd5.status} uniqueFrames=${uniqueFrames.size}`);
  const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', video, '-map', '0:a:0',
    '-f', 's16le', '-ac', '2', '-ar', '44100', 'pipe:1'], { maxBuffer: 4 * 1024 * 1024 });
  let peak = 0;
  if (decoded.status === 0) {
    for (let i = 0; i + 1 < decoded.stdout.length; i += 2) {
      peak = Math.max(peak, Math.abs(decoded.stdout.readInt16LE(i)));
    }
  }
  check('recorded audio stream is non-silent', decoded.status === 0 && peak > 1000,
    `ffmpeg=${decoded.status} peak=${peak}`);

  await ctl('quit');
  const code = await Promise.race([
    childExit,
    new Promise(resolve => setTimeout(() => resolve('timeout'), 10000)),
  ]);
  check('quit wakes and closes a frozen CLI', code === 0, `exit=${code}`);

  // A process audit or terminal close sends SIGTERM rather than `ctl quit`.
  // That used to call process.exit() from the signal handler, orphaning the
  // encoder's hidden video-only temporary file and dropping the requested
  // MP4. Exercise the actual HTTP/frozen/ffmpeg path so this cannot regress.
  const signalPort = PORT + 1;
  signalChild = spawn(process.execPath, [
    RUN, `--exe=${EXE}`, `--control=${signalPort}`, '--frozen',
    '--tick-ms-per-batch=20', '--batch-size=50000', '--max-seconds=45',
    '--quiet-api', '--quiet-blocks', '--no-close', '--no-build',
  ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let signalOut = '';
  signalChild.stdout.on('data', d => { signalOut += d; });
  signalChild.stderr.on('data', d => { signalOut += d; });
  let signalCode = null;
  const signalExit = new Promise(resolve => signalChild.on('exit', code => {
    signalCode = code;
    resolve(code);
  }));
  const signalCtl = (...args) => new Promise((resolve, reject) => {
    execFile(process.execPath, [CTL, `--port=${signalPort}`, ...args], {
      cwd: ROOT, encoding: 'utf8', timeout: 20000,
    }, (error, stdout) => error ? reject(error) : resolve(stdout));
  });
  while (!signalOut.includes('[control] listening')) {
    if (signalCode !== null) throw new Error(`signal child exited ${signalCode}\n${signalOut.slice(-3000)}`);
    if (Date.now() >= deadline) throw new Error(`timed out waiting for signal-run control server\n${signalOut.slice(-3000)}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await signalCtl('record', 'on', signalVideo);
  // Keep a long step request in flight: the Quake incident was terminated
  // while a combat slice was active, not while the runner was already parked.
  const interruptedStep = signalCtl('step', '100000').catch(() => null);
  await new Promise(resolve => setTimeout(resolve, 250));
  signalChild.kill('SIGTERM');
  const gracefulCode = await Promise.race([
    signalExit,
    new Promise(resolve => setTimeout(() => resolve('timeout'), 10000)),
  ]);
  check('SIGTERM takes the orderly frozen-run cleanup path',
    gracefulCode === 0 && /\[signal\] SIGTERM requested orderly shutdown/.test(signalOut),
    `exit=${gracefulCode} output=${signalOut.slice(-1000)}`);
  check('SIGTERM finalizes the requested MP4',
    fs.existsSync(signalVideo) && fs.statSync(signalVideo).size > 1000
      && /\[video\] wrote .*signal-finalized\.mp4/.test(signalOut),
    fs.existsSync(signalVideo) ? `${fs.statSync(signalVideo).size} bytes` : 'missing');
  await interruptedStep;
})().catch(error => {
  console.log(`FAIL  ${error.message}`);
  failed = true;
}).finally(() => {
  try { if (child.exitCode === null) child.kill('SIGTERM'); } catch (_) {}
  try { if (signalChild && signalChild.exitCode === null) signalChild.kill('SIGKILL'); } catch (_) {}
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  console.log(failed ? 'TEST FAILED' : 'TEST PASSED');
  process.exit(failed ? 1 : 0);
});
