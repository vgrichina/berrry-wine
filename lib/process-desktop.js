'use strict';

// Node desktop for related CLI OS processes. Only the authority owns the
// directory; bridges keep synchronous host imports independent of the guest
// event loop. Entries describe real USER rows, never shadow renderer windows.
const { Worker, isMainThread, workerData, parentPort } = require('node:worker_threads');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const ENV = 'WINE_PROCESS_DESKTOP';
const CAPACITY = 1024 * 1024;
const TIMEOUT = 3000;
const WS_VISIBLE = 1 << 28;
const WS_DISABLED = 1 << 27;
const fault = code => Object.assign(new Error(`Process desktop: ${code}`), { code });
function finish(buffer, response) {
  let bytes = Buffer.from(JSON.stringify(response));
  if (bytes.length > CAPACITY) bytes = Buffer.from('{"error":"ENOSPC"}');
  new Uint8Array(buffer, 8).set(bytes);
  const words = new Int32Array(buffer, 0, 2);
  Atomics.store(words, 1, bytes.length);
  Atomics.store(words, 0, 1);
  Atomics.notify(words, 0);
}
function receive(buffer) {
  const words = new Int32Array(buffer, 0, 2);
  if (Atomics.wait(words, 0, 0, TIMEOUT) === 'timed-out') throw fault('ETIMEDOUT');
  const response = JSON.parse(Buffer.from(buffer, 8, Atomics.load(words, 1)).toString());
  if (response.error) throw fault(response.error);
  return response.value;
}
function frames(socket, callback) {
  let pending = '';
  socket.setEncoding('utf8');
  socket.on('data', chunk => {
    pending += chunk;
    if (Buffer.byteLength(pending) > CAPACITY) return socket.destroy();
    let at;
    while ((at = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, at); pending = pending.slice(at + 1);
      try { callback(JSON.parse(line)); } catch { socket.destroy(); return; }
    }
  });
}

function serve({ endpoint, buffer }) {
  const sessions = new Set();
  let serial = 0, order = 0, foreground = null;
  const live = row => {
    for (const s of sessions) if (!s.retired && s.id === row.session &&
      s.windows.get(row.hwnd)?.generation === row.generation) return true;
    return false;
  };
  const locate = hwnd => {
    for (const s of sessions) {
      const row = s.windows.get(hwnd >>> 0);
      if (!s.retired && row) return { s, row };
    }
    return null;
  };
  const server = net.createServer(socket => {
    let session;
    const retire = () => {
      if (!session) return;
      session.retired = true; session.windows.clear(); session.queue.length = 0;
      if (foreground && !live(foreground)) foreground = null;
    };
    socket.on('error', () => {});
    socket.on('close', () => { retire(); sessions.delete(session); });
    frames(socket, request => {
      let value;
      try {
        if (!session) {
          if (request.op !== 'hello' || request.token !== endpoint.token) throw fault('EAUTH');
          // Never recycle a process identity or its HWND range in a namespace.
          if (++serial > 0x7ffe) throw fault('ENOSPC');
          session = { id: randomUUID(), processId: 996 + serial * 4,
            hwndBase: serial * 0x10000 + 1, windows: new Map(), queue: [], retired: false };
          sessions.add(session);
          value = { processId: session.processId, hwndBase: session.hwndBase, session: session.id };
        } else if (request.op === 'retire') { retire(); value = true; }
        else if (request.op === 'publish') {
          if (session.retired) throw fault('ECLOSED');
          if (!Array.isArray(request.rows) || request.rows.length > 4096) throw fault('EINVAL');
          const next = new Map();
          for (const input of request.rows) {
            if (!Number.isInteger(input.hwnd) || input.hwnd < session.hwndBase ||
                input.hwnd >= session.hwndBase + 0x10000 ||
                typeof input.generation !== 'string' || !/^[0-9]+$/.test(input.generation)) throw fault('EINVAL');
            const old = session.windows.get(input.hwnd);
            const row = { ...input, session: session.id, processId: session.processId,
              order: old?.generation === input.generation && old.z === input.z ? old.order : ++order };
            next.set(row.hwnd, row);
          }
          session.windows = next;
          if (foreground && !live(foreground)) foreground = null;
          value = true;
        } else if (request.op === 'snapshot') {
          value = { rows: [...sessions].flatMap(s => [...s.windows.values()]),
            foreground: foreground && live(foreground) ? foreground.hwnd : 0 };
        } else if (request.op === 'poll') {
          if (session.retired) value = [];
          else value = session.queue.splice(0, Math.max(0, Math.min(256, request.limit | 0)))
            .filter(message => live(message));
        } else if (request.op === 'post' || request.op === 'activate') {
          if (session.retired) throw fault('ECLOSED');
          const target = locate(request.hwnd);
          if (!target || target.row.generation !== request.generation ||
              target.row.session !== request.session) value = false;
          else if (target.s.queue.length >= 256) value = false;
          else {
            const message = { ...request, generation: target.row.generation, session: target.row.session };
            target.s.queue.push(message);
            if (request.op === 'activate') foreground = target.row;
            value = true;
          }
        } else if (request.op === 'foreground') {
          const target = locate(request.hwnd);
          foreground = target && target.s === session ? target.row : null;
          value = true;
        } else throw fault('EINVAL');
        socket.write(JSON.stringify({ value }) + '\n');
      } catch (error) { socket.write(JSON.stringify({ error: error.code || 'EINVAL' }) + '\n'); }
    });
  });
  server.maxConnections = 128;
  server.once('error', () => finish(buffer, { error: 'ECONNECTION' }));
  server.listen(endpoint.path, () => finish(buffer, { value: true }));
}
function bridge({ endpoint }) {
  let pending, broken = false;
  const socket = net.createConnection(endpoint.path);
  const fail = () => {
    broken = true;
    if (pending) { finish(pending, { error: 'ECONNECTION' }); pending = null; }
  };
  socket.on('error', fail); socket.on('close', fail);
  frames(socket, response => {
    if (!pending) return socket.destroy();
    finish(pending, response); pending = null;
  });
  parentPort.on('message', ({ request, buffer }) => {
    if (broken) return finish(buffer, { error: 'ECONNECTION' });
    if (pending) return finish(buffer, { error: 'EBUSY' });
    const payload = JSON.stringify({ ...request, token: endpoint.token });
    if (Buffer.byteLength(payload) >= CAPACITY) return finish(buffer, { error: 'ENOSPC' });
    pending = buffer; socket.write(payload + '\n');
  });
}

class ProcessDesktop {
  constructor({ endpoint = process.env[ENV] ? JSON.parse(process.env[ENV]) : null } = {}) {
    this.contexts = [];
    this.pending = [];
    this.signature = null;
    this.retired = false;
    this.buffer = new SharedArrayBuffer(CAPACITY + 8);
    if (!endpoint) {
      this.directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wine-desktop-'));
      fs.chmodSync(this.directory, 0o700);
      endpoint = { path: path.join(this.directory, 'socket'), token: randomUUID() };
      const ready = new SharedArrayBuffer(CAPACITY + 8);
      this.authority = new Worker(__filename, { workerData: { role: 'desktop-authority', endpoint, buffer: ready } });
      this.authority.on('error', () => {}); this.authority.unref();
      receive(ready);
    }
    this.endpoint = endpoint;
    this.worker = new Worker(__filename, { workerData: { role: 'desktop-client', endpoint } });
    this.worker.on('error', () => {}); this.worker.unref();
    try { Object.assign(this, this.call({ op: 'hello' })); }
    catch (error) { void this.close(); throw error; }
  }
  call(request) {
    if (this.closed) throw fault('ECLOSED');
    Atomics.store(new Int32Array(this.buffer, 0, 2), 0, 0);
    this.worker.postMessage({ request, buffer: this.buffer });
    try { return receive(this.buffer); }
    catch (error) {
      // An unknown outcome cannot be retried over a reused response buffer.
      if (['ETIMEDOUT', 'ECONNECTION'].includes(error.code)) {
        this.closed = true; void this.worker.terminate();
      }
      throw error;
    }
  }
  environment(base = process.env) { return { ...base, [ENV]: JSON.stringify(this.endpoint) }; }
  read(context, pointer, wide = false) {
    if (!pointer) return '';
    const memory = context.getMemory();
    const view = new DataView(memory);
    let text = '';
    for (let at = pointer >>> 0, n = 0; n < 32768 && at + (wide ? 2 : 1) <= view.byteLength; at += wide ? 2 : 1, n++) {
      const c = wide ? view.getUint16(at, true) : view.getUint8(at);
      if (!c) return text;
      text += String.fromCharCode(c);
    }
    throw fault('EINVAL');
  }
  rows() {
    const rows = new Map();
    for (const { ctx } of this.contexts) {
      const e = ctx.exports || ctx.instance?.exports;
      if (!e?.wnd_lookup_slot) continue;
      const windows = ctx.renderer?.windows || {};
      for (let slot = 0; ; slot++) {
        const hwnd = e.wnd_lookup_slot(slot);
        if (hwnd === -1) break;
        if (!hwnd || !e.wnd_lookup_live(hwnd)) continue;
        const h = hwnd >>> 0, win = windows[h];
        const generation = String(e.wnd_lookup_generation(h));
        const classPtr = e.wnd_lookup_class(h);
        const builtins = ['Button', 'Edit', 'Static', 'ListBox', 'ScrollBar', 'ComboBox'];
        const className = classPtr >= 0x80 && classPtr <= 0x85 ? builtins[classPtr - 0x80]
          : this.read(ctx, classPtr, !!e.wnd_lookup_class_wide(h));
        const parent = e.wnd_get_parent(h) >>> 0;
        const style = win ? win.style >>> 0 : e.wnd_get_style_export(h) >>> 0;
        const x = win ? win.x | 0 : e.wnd_window_screen_x?.(h) | 0;
        const y = win ? win.y | 0 : e.wnd_window_screen_y?.(h) | 0;
        const w = win ? win.w | 0 : e.wnd_screen_w?.(h) | 0;
        const ht = win ? win.h | 0 : e.wnd_screen_h?.(h) | 0;
        rows.set(h, { hwnd: h, generation, className, title: this.read(ctx, e.wnd_lookup_title(h)),
          parent, owner: e.wnd_get_owner?.(h) >>> 0,
          z: win?.zOrder ?? e.wnd_z_get(h), style,
          visible: win ? win.visible !== false : !!(style & WS_VISIBLE),
          enabled: win ? win.enabled !== false : !(style & WS_DISABLED),
          rect: [x, y, x + w, y + ht], client: win?.clientRect || { x, y, w, h: ht } });
      }
    }
    return [...rows.values()];
  }
  publish() {
    if (this.retired || this.closed) return;
    const rows = this.rows(), signature = JSON.stringify(rows);
    if (signature === this.signature) return;
    this.call({ op: 'publish', rows }); this.signature = signature;
  }
  snapshot() { this.publish(); return this.call({ op: 'snapshot' }); }
  lookup(hwnd) { return this.snapshot().rows.find(row => row.hwnd === (hwnd >>> 0)); }
  foreign(hwnd) {
    const h = hwnd >>> 0;
    return h >= 0x10001 && (h < this.hwndBase || h >= this.hwndBase + 0x10000);
  }
  route(op, hwnd, values = {}) {
    const rows = this.snapshot().rows;
    let row = rows.find(r => r.hwnd === (hwnd >>> 0));
    if (op === 'activate') {
      const seen = new Set();
      while (row?.parent && !seen.has(row.hwnd)) {
        seen.add(row.hwnd);
        row = rows.find(r => r.hwnd === row.parent);
      }
    }
    if (!row) return 0;
    return this.call({ op, hwnd: row.hwnd, generation: row.generation, session: row.session, ...values }) ? 1 : 0;
  }
  poll() {
    if (this.retired || this.closed || this.polling) return;
    this.polling = true;
    try {
      this.publish();
      const incoming = this.call({ op: 'poll', limit: 256 - this.pending.length });
      const messages = [...this.pending, ...incoming];
      this.pending = [];
      for (const message of messages) {
        const owner = this.contexts.find(({ ctx }) => {
          const e = ctx.exports || ctx.instance?.exports;
          return e?.wnd_lookup_live?.(message.hwnd) &&
            String(e.wnd_lookup_generation(message.hwnd)) === message.generation;
        });
        if (!owner) continue;
        if (message.op === 'post') {
          const e = owner.ctx.exports || owner.ctx.instance?.exports;
          if (!e.post_message_q(message.hwnd, message.msg, message.wParam, message.lParam))
            this.pending.push(message);
        } else if (message.op === 'activate') owner.original.activate_window(message.hwnd);
      }
    } finally { this.polling = false; }
  }
  attach(ctx, host) {
    ctx.processId = this.processId;
    const original = { ...host };
    this.contexts.push({ ctx, original });
    const wrap = (name, fn) => { if (original[name]) host[name] = fn; };
    for (const name of ['create_window', 'set_window_class', 'set_window_text', 'show_window',
      'dialog_loaded', 'destroy_window', 'move_window', 'set_window_zorder', 'set_parent',
      'sync_window_client', 'sys_command']) {
      wrap(name, (...args) => { const result = original[name](...args); this.publish(); return result; });
    }
    wrap('find_window', (parent, after, classWA, titleWA, wide) => {
      parent >>>= 0; after >>>= 0;
      if (parent === 0x10000) parent = 0;
      const rows = this.snapshot().rows;
      if (parent && !rows.some(r => r.hwnd === parent)) return 0;
      const siblings = rows.filter(r => r.parent === parent).sort((a, b) =>
        b.order - a.order || b.z - a.z || b.hwnd - a.hwnd);
      const afterIndex = after ? siblings.findIndex(r => r.hwnd === after) : -1;
      if (after && afterIndex < 0) return 0;
      const builtin = ['button', 'edit', 'static', 'listbox', 'scrollbar', 'combobox'];
      const className = !classWA ? null : classWA >= 0x80 && classWA <= 0x85 ? builtin[classWA - 0x80]
        : this.read(ctx, classWA, !!(wide & 2)).toLowerCase();
      const title = titleWA ? this.read(ctx, titleWA, !!(wide & 1)).toLowerCase() : null;
      return siblings.slice(afterIndex + 1).find(r =>
        (className === null || r.className.toLowerCase() === className) &&
        (title === null || r.title.toLowerCase() === title))?.hwnd || 0;
    });
    wrap('get_window_info', (hwnd, prop) => {
      if (!this.foreign(hwnd)) return original.get_window_info(hwnd, prop);
      const row = this.lookup(hwnd);
      if (!row) return 0;
      return [row.style, +row.visible, +row.enabled, row.processId, 1, 0][prop] || 0;
    });
    const text = (hwnd, field) => this.foreign(hwnd) ? (this.lookup(hwnd)?.[field] || '') : null;
    const writeText = (value, buffer, max) => {
      if (max <= 0) return 0;
      const bytes = new Uint8Array(ctx.getMemory()), n = Math.min(value.length, max - 1);
      for (let i = 0; i < n; i++) bytes[buffer + i] = value.charCodeAt(i) & 255;
      bytes[buffer + n] = 0; return n;
    };
    for (const [name, field] of [['get_window_text', 'title'], ['get_window_class', 'className']]) {
      wrap(name, (hwnd, buffer, max) => {
        const value = text(hwnd, field);
        return value === null ? original[name](hwnd, buffer, max) : writeText(value, buffer, max);
      });
    }
    wrap('get_window_text_length', hwnd => text(hwnd, 'title')?.length ?? original.get_window_text_length(hwnd));
    wrap('get_window_rect', (hwnd, buffer) => {
      if (!this.foreign(hwnd)) return original.get_window_rect(hwnd, buffer);
      const row = this.lookup(hwnd);
      if (row) row.rect.forEach((n, i) => new DataView(ctx.getMemory()).setInt32(buffer + i * 4, n, true));
    });
    wrap('get_window_client_size', hwnd => {
      if (!this.foreign(hwnd)) return original.get_window_client_size(hwnd);
      const row = this.lookup(hwnd);
      return row ? (row.client.w & 65535) | (row.client.h << 16) : 0;
    });
    wrap('get_window_related', (hwnd, cmd) => {
      const rows = this.snapshot().rows;
      const row = rows.find(r => r.hwnd === (hwnd >>> 0));
      if (!row && hwnd !== 0 && (hwnd >>> 0) !== 0x10000) return 0;
      if (cmd === 4) return row?.owner || 0;
      if (cmd === 6 && !this.foreign(hwnd)) return original.get_window_related(hwnd, cmd);
      const siblings = rows.filter(r => r.parent === (cmd === 5 ? (row?.hwnd || 0) : row?.parent || 0))
        .sort((a, b) => b.order - a.order || b.z - a.z);
      if (cmd === 5 || cmd === 0) return siblings[0]?.hwnd || 0;
      if (cmd === 1) return siblings.at(-1)?.hwnd || 0;
      const at = siblings.findIndex(r => r.hwnd === (hwnd >>> 0));
      return cmd === 2 ? siblings[at + 1]?.hwnd || 0 : cmd === 3 ? siblings[at - 1]?.hwnd || 0 : 0;
    });
    wrap('post_window_message', (hwnd, msg, wParam, lParam) => {
      if (!this.foreign(hwnd)) return original.post_window_message(hwnd, msg, wParam, lParam);
      // Scalar user messages and a small set of pointer-free USER messages.
      if (msg < 0x400 && ![0, 0x10, 0x111, 0x112].includes(msg)) return 0;
      return this.route('post', hwnd, { msg: msg >>> 0, wParam: wParam >>> 0, lParam: lParam >>> 0 });
    });
    wrap('activate_window', hwnd => {
      if (this.foreign(hwnd)) return this.route('activate', hwnd);
      const result = original.activate_window(hwnd);
      this.publish();
      if (result) this.call({ op: 'foreground', hwnd: original.foreground_window() });
      return result;
    });
    wrap('foreground_window', () => this.snapshot().foreground);
    wrap('check_input', (...args) => { this.poll(); return original.check_input(...args); });
  }
  retire() {
    if (!this.retired && !this.closed) {
      this.call({ op: 'retire' }); this.retired = true; this.pending = [];
    }
  }
  close() {
    if (this.closing) return this.closing;
    try { this.retire(); } catch { /* broken transport already retired by disconnect */ }
    this.closed = true;
    this.closing = (async () => {
      await this.worker?.terminate();
      await this.authority?.terminate();
      if (this.directory) fs.rmSync(this.directory, { recursive: true, force: true });
    })();
    return this.closing;
  }
}

if (!isMainThread && workerData?.role === 'desktop-authority') serve(workerData);
else if (!isMainThread && workerData?.role === 'desktop-client') bridge(workerData);
module.exports = { ProcessDesktop };
