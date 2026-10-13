#!/usr/bin/env node
'use strict';

// Screenshot-only Blobby Volley player using the Decisions API.
// https://developers.openai.com/api/docs/guides/decisions
// OPENAI_API_KEY=... node tools/blobby-decisions.js --seconds=30
// node tools/blobby-decisions.js --smoke   (scripted input; no model calls)
// Optional: --key-file=/private/path/key --port=8107 --headful --record
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => args.find(x => x.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const smoke = args.includes('--smoke');
const seconds = Number(opt('seconds', smoke ? '2' : '30'));
const port = Number(opt('port', '8107'));
const key = process.env.OPENAI_API_KEY || (opt('key-file', '') ? fs.readFileSync(opt('key-file'), 'utf8').trim() : '');
if (!smoke && !key) throw new Error('Set OPENAI_API_KEY or pass --key-file=PATH. --smoke tests only game input.');
if (!(seconds > 0 && seconds <= 300)) throw new Error('--seconds must be in (0,300]');
const startedAt = new Date().toISOString();
const out = path.join(ROOT, 'scratch/runs', `blobby-decisions-${Date.now()}`);
fs.mkdirSync(out, { recursive: true });
console.log(out);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const actions = { stay: [], left: [65], right: [68], jump: [87], left_jump: [65, 87], right_jump: [68, 87] };
let browser, session, held = [], stopped = false, server, recorder;
process.on('SIGINT', () => { stopped = true; });
process.on('SIGTERM', () => { stopped = true; });
const base = `http://127.0.0.1:${port}`;
async function ctl(command) {
  const response = await fetch(`${base}/api/agent/ctl?s=${encodeURIComponent(session)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  for (const item of Array.isArray(result) ? result : [result]) {
    if (!item.ok) throw new Error(item.error || JSON.stringify(item));
  }
  return result.value;
}
async function keys(next) {
  const commands = [
    ...held.filter(k => !next.includes(k)).map(k => ({ cmd: `keyup:${k}` })),
    ...next.filter(k => !held.includes(k)).map(k => ({ cmd: `keydown:${k}` })),
  ];
  if (commands.length) await ctl(commands);
  held = next;
}
async function capture(name) {
  const url = await ctl({ action: 'png' });
  if (!/^data:image\/png;base64,/.test(url)) throw new Error('Missing PNG');
  fs.writeFileSync(path.join(out, name), Buffer.from(url.split(',')[1], 'base64'));
  return url;
}
async function decide(previous, current, gapMs) {
  const t = performance.now();
  const response = await fetch('https://api.openai.com/v1/decisions', {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-6-luna', input: [{ role: 'user', content: [
      { type: 'input_text', text: `Play Blobby Volley as the RED LEFT player against the green computer. Images are chronological, ${Math.round(gapMs)} ms apart. Predict where the ball will land on our half. Move underneath it; jump to serve or hit it over the center net. Stay on the left half. Your action lasts about 150 ms, plus the next inference latency. Current held keys: ${held.join(',') || 'none'}.` },
      { type: 'input_image', image_url: previous }, { type: 'input_image', image_url: current },
    ] }], questions: [{ type: 'choice', name: 'action',
      instructions: 'Which action best keeps the ball off our ground and returns it over the net?',
      choices: Object.keys(actions).map(value => ({ value, description: {
        stay: 'Release all controls.', left: 'Move left.', right: 'Move right toward the net.',
        jump: 'Jump without moving horizontally.', left_jump: 'Move left and jump.', right_jump: 'Move right and jump.',
      }[value] })),
    }] }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    // Authentication errors can echo key fragments; log only typed error codes.
    throw new Error(`Decisions HTTP ${response.status} (${body.error?.code || body.error?.type || 'unknown'})`);
  }
  const result = await response.json();
  const answer = result.answers?.find(a => a.name === 'action');
  if (answer?.type !== 'choice' || !Object.hasOwn(actions, answer.choice)) throw new Error('Missing, refused, or invalid action');
  return { action: answer.choice, latencyMs: performance.now() - t, answer, usage: result.usage };
}
(async () => {
  let outcome = 'failed', error = null, count = 0;
  try {
    // Refuse to borrow a server that may belong to another agent.
    const occupied = await fetch(base, { signal: AbortSignal.timeout(500) }).then(() => true, () => false);
    if (occupied) throw new Error(`Port ${port} occupied; choose --port`);
    server = spawn(process.execPath, ['tools/dev-server.js', `--port=${port}`, '--quiet'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let serverText = '';
    for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => {
      serverText += chunk; fs.appendFileSync(path.join(out, 'server.log'), chunk);
    });
    const deadline = Date.now() + 30000;
    while (!serverText.includes('dev server:') && server.exitCode === null && Date.now() < deadline) await sleep(100);
    if (!serverText.includes('dev server:')) throw new Error('Server failed to start');
    browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: !args.includes('--headful') });
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 750 });
    page.on('pageerror', e => fs.appendFileSync(path.join(out, 'page-errors.log'), String(e) + '\n'));
    await page.goto(`${base}/?debug&app=blobby_volley`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.WineFrozen?.status().hosts > 0, { timeout: 90000 });
    for (let i = 0; i < 100 && !session; i++) {
      const data = await fetch(`${base}/api/agent/sessions`).then(r => r.json());
      session = data.sessions?.find(s => s.href.includes('app=blobby_volley'))?.id;
      if (!session) await sleep(200);
    }
    if (!session) throw new Error('No browser control session');
    await sleep(8000);
    await capture('menu.png');
    await ctl({ cmd: 'mousemove:400:222' });
    await sleep(150);
    await ctl({ cmd: 'mousedown:400:222' });
    await sleep(150);
    await ctl({ cmd: 'mouseup:400:222' });
    await sleep(1000);
    let previous = await capture('start.png'), previousAt = Date.now();
    if (args.includes('--record')) {
      const screen = await page.$('#screen');
      const crop = screen ? await screen.boundingBox() : undefined;
      recorder = await page.screencast({ path: path.join(out, 'gameplay.mp4'), format: 'mp4', fps: 30, crop });
    }
    const end = Date.now() + seconds * 1000;
    while (Date.now() < end && !stopped) {
      await sleep(150);
      const now = Date.now();
      const current = await capture(`frame-${String(count).padStart(4, '0')}.png`);
      const decision = smoke ? { action: ['right_jump', 'left', 'jump', 'stay'][count % 4], scripted: true }
        : await decide(previous, current, now - previousAt);
      await keys(actions[decision.action]);
      fs.appendFileSync(path.join(out, 'decisions.jsonl'), JSON.stringify({ frame: count, at: now, ...decision }) + '\n');
      console.log(count, decision.action, decision.latencyMs?.toFixed(0) ?? 'scripted');
      previous = current; previousAt = now; count++;
    }
    await keys([]);
    await capture('end.png');
    if (fs.readFileSync(path.join(out, 'start.png')).equals(fs.readFileSync(path.join(out, 'end.png')))) {
      throw new Error('Game frame did not change during control loop');
    }
    outcome = 'passed';
  } catch (e) { error = String(e); console.error(error); process.exitCode = 1; }
  finally {
    if (session) await keys([]).catch(() => {});
    if (recorder) {
      await recorder.stop().catch(e => { outcome = 'failed'; error = `Recording finalization failed: ${e.message}`; });
    }
    const browserVersion = browser ? await browser.version().catch(() => null) : null;
    if (browser) await browser.close();
    if (server) server.kill('SIGTERM');
    const result = { candidateId: 'blobby-volley', agentId: 'codex:blobby-decisions', startedAt,
      finishedAt: new Date().toISOString(), outcome, route: smoke ? 'scripted-input-smoke' : 'decisions-gameplay',
      command: `node tools/blobby-decisions.js ${args.filter(a => !a.startsWith('--key-file=')).join(' ')}`,
      build: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), wasmSha256: null, dirtyPatchSha256: null },
      environment: { mode: 'browser', browserVersion, renderer: 'unknown', viewport: '900x750' },
      summary: error || `${count} ${smoke ? 'scripted actions; no API calls' : 'Decisions API actions'}. Outcome applies to harness completion, not match victory.`,
      verification: 'unreviewed', screenshots: ['menu.png', 'start.png', 'end.png'].filter(f => fs.existsSync(path.join(out, f))),
      artifacts: ['server.log', 'decisions.jsonl', 'page-errors.log', 'gameplay.mp4'].filter(f => fs.existsSync(path.join(out, f))) };
    fs.writeFileSync(path.join(out, 'result.json.tmp'), JSON.stringify(result, null, 2) + '\n');
    fs.renameSync(path.join(out, 'result.json.tmp'), path.join(out, 'result.json'));
  }
})();
