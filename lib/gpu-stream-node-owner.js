'use strict';

const { Worker, MessageChannel, receiveMessageOnPort } = require('node:worker_threads');

class NodeRenderOwner {
  constructor({ module, memory, onFrame, onStats }) {
    if (!(module instanceof WebAssembly.Module) || !(memory instanceof SharedArrayBuffer))
      throw new TypeError('Node render owner requires a compiled module and shared ring memory');
    const { port1, port2 } = new MessageChannel();
    this.port = port1;
    this.control = new Int32Array(new SharedArrayBuffer(8));
    this.next = 0;
    this.error = null;
    this.closed = false;
    this.memory = memory;
    this.rings = new Set();
    this.onFrame = onFrame;
    this.onStats = onStats;
    this.worker = new Worker(require.resolve('./gpu-stream-node-worker'), {
      workerData: { module, memory, port: port2, control: this.control.buffer }, transferList: [port2],
    });
    this.exit = new Promise(resolve => this.worker.once('exit', code => {
      if (!this.closed && !this.error) this.error = new Error('Render owner exited: ' + code);
      resolve(code);
    }));
    this.worker.on('error', error => { this.error ||= error; });
    this.port.on('message', msg => this._message(msg));
  }
  _message(msg) {
    if (msg.error) this.error ||= new Error(msg.error);
    if (msg.frame && !this.closed) this.onFrame(msg.frame);
    if (msg.stats) this.onStats?.(msg);
  }
  collect() {
    let packet;
    while ((packet = receiveMessageOnPort(this.port))) this._message(packet.message);
    if (this.error) throw this.error;
  }
  _wait(word, target) {
    let progress = Atomics.load(this.control, word), since = performance.now();
    while (progress < target) {
      this.collect();
      if (progress < 0) throw this.error || new Error('Render owner initialization failed');
      // A finite dead-owner bound. No input deadline depends on this timeout.
      if (performance.now() - since > 30000) throw new Error('Render owner made no progress for 30000 ms');
      Atomics.wait(this.control, word, progress, 10);
      const next = Atomics.load(this.control, word);
      if (next !== progress) { progress = next; since = performance.now(); }
    }
    this.collect();
  }
  kick(ring, mode) {
    if (this.closed) throw new Error('Render owner closed');
    this.collect();
    this.rings.add(ring);
    this._wait(0, 1);
    const id = ++this.next;
    if (id >= 0x7fffffff) throw new Error('Render owner command sequence exhausted');
    this.port.postMessage({ ring, mode, id });
    if (mode !== 0) this._wait(1, id);
    if (mode === 2) { this.closed = true; this.port.close(); }
    return 1;
  }
  async flush() {
    const target = this.next;
    let progress = Atomics.load(this.control, 1), since = performance.now();
    while (progress < target) {
      this.collect();
      if (this.closed) throw new Error('Render owner closed during flush');
      if (performance.now() - since > 30000) throw new Error('Render owner made no progress for 30000 ms');
      const wait = Atomics.waitAsync(this.control, 1, progress, 10);
      if (wait.async) await wait.value;
      const next = Atomics.load(this.control, 1);
      if (next !== progress) { progress = next; since = performance.now(); }
    }
    this.collect();
  }
  async close() {
    if (!this.closed) {
      this.closed = true;
      Atomics.notify(this.control, 1);
      this.port.close();
      await this.worker.terminate();
      const GS = require('./gpu-stream');
      for (const addr of this.rings) {
        const ring = new GS.Ring(() => this.memory, addr);
        if (ring.readPos !== ring.writePos && !ring.errorCode)
          ring.fail((ring.word('done_seq') + 1) >>> 0, GS.ERR.EXECUTOR);
      }
    }
    await this.exit;
  }
}
module.exports = { NodeRenderOwner };
