#!/usr/bin/env node
'use strict';

// The browser's --trace-api formats a call's arguments from the guest stack,
// and it used to read ESP from the page's own instance. In Threads mode the
// guest main thread runs in a Worker and the page's instance runs no guest
// code, so every traced argument printed as 0x00000000 (seen on Age of
// Wonders II). `log` is also fire-and-forget and batched, so the page sees it
// after the guest has moved on. A Worker that forwards guest logs now reads
// its own stack at call time and sends [esp, return address, arg0..arg7]
// after (ptr, len); host.js's h.log formats from those words.

const assert = require('assert');
const RPC = require('../lib/guest-rpc');

const memory = { buffer: new SharedArrayBuffer(8192 * 65536) };
const sigs = { log: { params: ['i32', 'i32'], results: [] } };
const seen = [];
const main = RPC.createMainBroker(memory, { log: (...a) => { seen.push(a); } }, sigs, {});

// A fake guest: ESP and a stack of dwords, as the Worker's instance sees it.
let esp = 0x7ec5ffd8;
const stack = new Map();
const setStack = (base, words) => words.forEach((w, i) => stack.set((base + i * 4) >>> 0, w >>> 0));
const exportsOf = () => ({ get_esp: () => esp, guest_read32: a => stack.get(a >>> 0) || 0 });

const worker = RPC.createWorkerImports(memory, sigs, message => {
  if (message.t === 'calls') main.serveCalls(message);
  else if (message.t === 'rpc') main.serveRpc(message.slot);
}, { slot: 2, forwardGuestLogs: true, getExports: exportsOf });

setStack(esp, [0x00513bed, 0x08140008, 0x1c4, 0x29, 0x08140070, 0x074ff9b0, 0, 0, 0]);
worker.imports.host.log(0x1000, 16);
// The guest moves on before the batch reaches the page.
setStack(esp, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
esp = 0x7eb5ffe0;
worker.flushAsync();

assert.strictEqual(seen.length, 1, 'the log reached the page');
assert.deepStrictEqual(seen[0].slice(0, 2), [0x1000, 16], 'name pointer and length unchanged');
assert.deepStrictEqual(seen[0].slice(2),
  [0x7ec5ffd8, 0x00513bed, 0x08140008, 0x1c4, 0x29, 0x08140070, 0x074ff9b0, 0, 0, 0],
  'ESP, return address and eight argument dwords as they were at call time');

// Without forwarded guest logs the import stays a local no-op, as before.
const quiet = RPC.createWorkerImports(memory, sigs, () => {
  throw new Error('a non-forwarded log must not post');
}, { slot: 4, getExports: exportsOf });
quiet.imports.host.log(0x1000, 16);
quiet.flushAsync();

console.log('PASS  a Worker\'s forwarded log carries its call-time stack words to the page');
