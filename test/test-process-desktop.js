#!/usr/bin/env node
'use strict';
// PREP: syntax-check only until ordered Alice -> GL release. Actual production
// host imports and WAT window records, in different forked OS processes.
// DESKTOP_OLD=1 omits ONLY the desktop adapter; expected first failure is the
// cross-process class/title match, never a missing module/import failure.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { fork } = require('node:child_process');
const ROOT = process.env.DESKTOP_REPO || path.resolve(__dirname, '..');
const old = process.env.DESKTOP_OLD === '1';
const { bootRenderHarness } = require(path.join(ROOT, 'test/render-helper'));
const extraWat = fs.readFileSync(path.join(__dirname, 'process-desktop-fixture.wat'), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const children = new Set();
let desktop;

async function fixture() {
  const f = await bootRenderHarness({ extraWat, fonts: 'none', beforeInstantiate: (ctx, host) => {
    if (!old) {
      const { ProcessDesktop } = require(path.join(ROOT, 'lib/process-desktop'));
      desktop = new ProcessDesktop();
      desktop.attach(ctx, host);
    }
  } });
  if (!old) {
    f.exports.set_process_id(desktop.processId);
    f.exports.set_hwnd_base(desktop.hwndBase);
  }
  const e = f.exports, h = f.host;
  const str = (s, wide = false) => {
    if (s === null || s === undefined) return 0;
    const b = Buffer.from(s + '\0', wide ? 'utf16le' : 'latin1');
    const p = e.guest_alloc(b.length) >>> 0;
    for (let i = 0; i < b.length; i++) e.guest_write8(p + i, b[i]);
    return p;
  };
  const wa = p => p ? e.guest_to_wasm(p) >>> 0 : 0;
  const base = desktop?.hwndBase || 0x10001;
  const make = (offset, title, className, parent = 0, rendered = true) => {
    const hwnd = base + offset, c = str(className), t = str(title);
    const wc = e.guest_alloc(40);
    e.guest_write32(wc + 36, c);
    e.fixture_window(hwnd, parent, c, t, parent ? 0x50000000 : 0x90000000, wc);
    if (rendered) h.create_window(hwnd, parent ? 0x50000000 : 0x90000000,
      10, 20, 320, 240, wa(t), 0);
    h.set_window_class(hwnd, wa(c));
    return hwnd;
  };
  const find = (c = null, t = null, parent = 0, after = 0, wide = false) =>
    wide ? e.fixture_find_w(str(c, true), str(t, true)) >>> 0
      : e.fixture_find_ex(parent, after, str(c), str(t)) >>> 0;
  return { ...f, e, h, str, wa, base, make, find };
}

function launch(env) {
  const c = fork(__filename, ['child'], {
    env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  children.add(c);
  let output = '', serial = 0;
  const pending = new Map();
  c.stdout.on('data', b => { output += b; });
  c.stderr.on('data', b => { output += b; });
  c.on('exit', () => {
    children.delete(c);
    for (const { reject } of pending.values()) reject(new Error('child exit: ' + output.slice(-2000)));
  });
  c.on('message', msg => {
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.value);
  });
  return {
    child: c,
    call(op, args = []) {
      const id = ++serial;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id); reject(new Error('child command timeout: ' + op + '\n' + output.slice(-2000)));
        }, 45000);
        pending.set(id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } });
        c.send({ id, op, args });
      });
    },
  };
}

async function child() {
  const f = await fixture();
  let closing = false;
  const closeChild = async () => {
    if (closing) return;
    closing = true;
    await desktop?.close();
    process.exit(0);
  };
  process.on('SIGTERM', closeChild);
  process.on('disconnect', closeChild);
  let hwnd = 0;
  const posted = [];
  // Observe delivery into this OS process's REAL WAT post queue without
  // changing the sender's route or fabricating a successful callback reply.
  const originalPost = f.e.post_message_q;
  // WebAssembly exports are non-configurable; use a plain forwarding view.
  const forwarded = Object.fromEntries(Object.keys(f.e).map(k => [k, f.e[k]]));
  forwarded.post_message_q = (...args) => { posted.push(args.map(x => x >>> 0)); return originalPost(...args); };
  f.hostCtx.exports = forwarded;
  process.on('message', async ({ id, op, args }) => {
    try {
      let value;
      if (op === 'ready') value = { osPid: process.pid, processId: desktop?.processId || 1000, base: f.base };
      else if (op === 'snapshot') value = desktop?.snapshot();
      else if (op === 'make') value = hwnd = f.make(...args);
      else if (op === 'find') value = f.find(...args);
      else if (op === 'rename') {
        const p = f.str(args[1]);
        f.e.fixture_title(args[0], p);
        f.h.set_window_text(args[0], f.wa(p)); value = true;
      } else if (op === 'hide') { f.h.show_window(args[0], 0); value = true; }
      else if (op === 'destroy') { f.h.destroy_window(args[0]); f.e.fixture_remove(args[0]); value = true; }
      else if (op === 'poll') { desktop?.poll(); value = { posted: [...posted], foreground: f.h.foreground_window(), keyboard: f.renderer._keyboardInputOwner?.hwnd || 0 }; }
      else if (op === 'retire') { desktop?.retire(); value = true; }
      else throw new Error('unknown child op ' + op);
      process.send({ id, value });
    } catch (e) { process.send({ id, error: e.stack }); }
  });
}

async function main() {
  const f = await fixture();
  const env = desktop ? desktop.environment(process.env) : { ...process.env };
  const a = launch(env), b = launch(env);
  const ai = await a.call('ready'), bi = await b.call('ready');
  assert.notEqual(ai.osPid, bi.osPid, 'different actual OS processes');
  assert.notEqual(ai.osPid, process.pid, 'parent is a third process');
  const ah = await a.call('make', [0, 'Jedi Knight', 'wKernel']);
  if (process.env.DESKTOP_DIAG) console.log(JSON.stringify({ child: await a.call('snapshot'), parent: desktop?.snapshot() }));
  assert.equal(f.find('wKernel', 'Jedi Knight'), ah,
    'separate OS process must find the existing class/title before another launch');
  // All assertions below are expected-success requirements; the old route
  // must fail at the preceding exact lookup, not a later incidental condition.
  assert.notEqual(ai.base, bi.base, 'real owner ranges cannot alias across OS processes');
  assert.notEqual(ai.processId, bi.processId);
  assert.equal(await b.call('find', ['wkernel', 'JEDI KNIGHT']), ah);
  assert.equal(f.find('wKernel', null), ah);
  assert.equal(f.find(null, 'Jedi Knight'), ah);
  assert.equal(f.find('Other', 'Jedi Knight'), 0);
  assert.equal(f.find('wKernel', 'Other'), 0);
  assert.equal(f.find('', 'Jedi Knight'), 0, 'empty class is not null wildcard');
  assert.equal(f.find('wKernel', ''), 0, 'empty title is not null wildcard');
  assert.equal(f.find(null, null), ah, 'both null enumerate the desktop');
  assert.equal(f.find('WKERNEL', 'JEDI KNIGHT', 0, 0, true), ah, 'UTF16 filters use calling memory');
  assert.equal(f.h.get_window_info(ah, 4), 1, 'foreign IsWindow');
  assert.equal(f.h.get_window_info(ah, 3), ai.processId, 'true foreign process identity');
  assert.equal(f.h.get_window_text_length(ah), 11);
  const out = f.wa(f.str(' '.repeat(40)));
  assert.equal(f.h.get_window_class(ah, out, 40), 7);
  assert.equal(Buffer.from(f.memory.buffer, out, 7).toString('latin1'), 'wKernel');
  f.h.get_window_rect(ah, out);
  const rect = new DataView(f.memory.buffer, out, 16);
  assert.deepEqual([0, 4, 8, 12].map(x => rect.getInt32(x, true)), [10, 20, 330, 260]);
  const ac = await a.call('make', [1, 'Pane', 'Static', ah, false]);
  assert.equal(f.find('Static', 'Pane'), 0, 'native child excluded from top-level search');
  assert.equal(f.find('Static', 'Pane', ah), ac, 'native child published without surface');
  assert.equal(f.find(null, null, ah, ac), 0, 'after direct child reaches end');
  assert.equal(f.find(null, null, ah, ah), 0, 'unrelated after rejected');
  const ac2 = await a.call('make', [2, 'Second pane', 'Static', ah, false]);
  const firstChild = f.find(null, null, ah);
  assert([ac, ac2].includes(firstChild));
  const secondChild = f.find(null, null, ah, firstChild);
  assert.equal(secondChild, firstChild === ac ? ac2 : ac,
    'FindWindowEx after follows one stable sibling ordering');
  assert.equal(f.find(null, null, ah, secondChild), 0);
  await a.call('hide', [ah]);
  assert.equal(f.find('wKernel', 'Jedi Knight'), ah, 'hidden windows remain searchable');
  await a.call('rename', [ah, 'Renamed']);
  assert.equal(f.find('wKernel', 'Jedi Knight'), 0);
  assert.equal(f.find('wKernel', 'Renamed'), ah);
  // Native PostMessage with scalar WM_APP and receiver-side delivery receipt.
  assert.equal(f.h.post_window_message(ah, 0x8001, 17, 29), 1);
  assert.deepEqual((await a.call('poll')).posted.at(-1), [ah, 0x8001, 17, 29]);
  assert.equal(f.e.fixture_post(ah, 0x8003, 23, 37), 1);
  assert.equal(f.e.get_esp() >>> 0, 0x00300014, 'foreign PostMessage stdcall cleanup');
  assert.deepEqual((await a.call('poll')).posted.at(-1), [ah, 0x8003, 23, 37]);
  assert.equal(f.h.get_window_info(ah, 5), 0,
    'separate OS process must not advertise an unavailable synchronous-send broker');
  assert.equal(f.e.fixture_send(ah, 0x8004, 1, 2), 0);
  assert.equal(f.e.fixture_last_error(), 50, 'unsupported foreign send reports ERROR_NOT_SUPPORTED');
  assert.equal(f.e.get_esp() >>> 0, 0x00300014, 'unsupported SendMessage stdcall cleanup');
  assert.equal(f.h.post_window_message(ah, 0x8002, 19, 31), 1);
  await a.call('destroy', [ah]);
  await a.call('make', [0, 'Replacement', 'wKernel']);
  const afterStale = await a.call('poll');
  assert(!afterStale.posted.some(row => row[1] === 0x8002), 'queued old generation cannot target replacement');
  assert.equal(f.h.activate_window(ah), 1);
  assert.equal((await a.call('poll')).foreground, ah, 'foreign activation reaches owner renderer');
  assert.equal(f.h.foreground_window(), ah, 'desktop foreground shared with caller');
  await a.call('destroy', [ah]);
  assert.equal(f.find('wKernel', 'Replacement'), 0);
  assert.equal(f.h.get_window_info(ah, 4), 0);
  assert.equal(f.h.activate_window(ah), 0);
  assert.equal(f.h.post_window_message(ah, 0x8001, 1, 2), 0, 'unknown target never queued into sender');
  assert.equal(f.h.post_window_message(0x7ffffffe, 0x8001, 1, 2), 0,
    'never-owned target must not fall back to the caller queue');
  const localQueueBefore = f.e.get_post_queue_count();
  assert.equal(f.e.fixture_post(ah, 0x8001, 1, 2), 0, 'guest rejects destroyed foreign target');
  assert.equal(f.e.get_post_queue_count(), localQueueBefore,
    'failed foreign post never falls through to the guest local queue');
  await b.call('make', [0, 'Exit witness', 'wKernel']);
  assert.equal(f.find('wKernel', 'Exit witness'), bi.base);
  await b.call('retire');
  assert.equal(f.find('wKernel', 'Exit witness'), 0, 'guest exit retires before OS host exit');
  await a.call('make', [0, 'Crash witness', 'wKernel']);
  a.child.kill('SIGKILL');
  await new Promise(resolve => a.child.once('exit', resolve));
  for (let n = 0; n < 200 && f.find('wKernel', 'Crash witness'); n++) await sleep(5);
  assert.equal(f.find('wKernel', 'Crash witness'), 0, 'unclean OS exit removes publications');
  if (!old) {
    const independentEnv = { ...process.env };
    for (const key of Object.keys(desktop.environment({}))) delete independentEnv[key];
    const isolated = launch(independentEnv);
    await isolated.call('ready');
    await isolated.call('make', [0, 'Independent namespace', 'wKernel']);
    assert.equal(f.find('wKernel', 'Independent namespace'), 0,
      'independent roots do not see or mutate another desktop namespace');
    isolated.child.kill('SIGTERM');
    await new Promise(resolve => isolated.child.once('exit', resolve));
    const c = launch(env), d = launch(env);
    await c.call('ready'); await d.call('ready');
    const ch = await c.call('make', [0, 'Root retirement witness', 'wKernel']);
    desktop.retire();
    assert.equal(await d.call('find', ['wKernel', 'Root retirement witness']), ch,
      'root guest retirement leaves authority usable by live child hosts');
    const dh = await d.call('make', [0, 'Sibling after root retirement', 'wKernel']);
    assert.equal(await c.call('find', ['wKernel', 'Sibling after root retirement']), dh);
  }
  console.log('PASS actual OS-process desktop lookup, ownership, lifecycle, post and foreground routing');
}

const timeout = setTimeout(() => { console.error('desktop fixture exceeded finite bound'); process.exit(1); }, 150000);
(process.argv[2] === 'child' ? child() : main()).catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  if (process.argv[2] === 'child') { clearTimeout(timeout); return; }
  await Promise.all([...children].map(c => new Promise(resolve => {
    const timer = setTimeout(() => { c.kill('SIGKILL'); }, 5000);
    c.once('exit', () => { clearTimeout(timer); resolve(); });
    c.kill('SIGTERM');
  })));
  await desktop?.close();
  clearTimeout(timeout);
});
