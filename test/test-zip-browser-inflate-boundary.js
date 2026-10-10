// Synthetic browser inflater regression: no ZIP tool or external fixture needed.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(require.resolve('../lib/zip-mount'), 'utf8');

function browserZip(scenario, declaredSize) {
  const state = { released: false, cancels: 0, bigAllocations: [] };
  let reader;
  const fakeStream = {
    getReader() { return reader; },
  };
  class FakeBlob {
    constructor(parts) { this.parts = parts; }
    stream() {
      return { pipeThrough() { return fakeStream; } };
    }
  }
  class FakeDecompressionStream {}
  reader = {
    async read() {
      if (scenario instanceof Error) throw scenario;
      return scenario.shift();
    },
    async cancel() { state.cancels++; },
    releaseLock() { state.released = true; },
  };
  const TrackedUint8Array = new Proxy(Uint8Array, {
    construct(target, args) {
      if (typeof args[0] === 'number' && args[0] > 1024 * 1024) {
        state.bigAllocations.push(args[0]);
      }
      return Reflect.construct(target, args);
    },
  });
  const window = {};
  vm.runInNewContext(source, {
    window,
    Blob: FakeBlob,
    DecompressionStream: FakeDecompressionStream,
    Uint8Array: TrackedUint8Array,
    ArrayBuffer,
    DataView,
    TextDecoder,
    Date,
    BigInt,
    console,
  }, { filename: 'zip-mount.js' });

  const localHeader = new Uint8Array(31);
  localHeader.set([0x50, 0x4b, 0x03, 0x04]);
  const entry = {
    name: 'hostile.bin', method: 8, flags: 0, localHeaderOffset: 0,
    compressedSize: 1, uncompressedSize: declaredSize, crc: 0,
  };
  const archive = new Uint8Array(localHeader);
  return {
    state,
    run() { return window.ZipMount.extractAsync(archive, entry); },
    setCrc(payload) { entry.crc = window.ZipMount.crc32(payload); },
  };
}

(async () => {
  const hugeShort = browserZip([
    { value: new Uint8Array([1, 2, 3]), done: false },
    { value: undefined, done: true },
  ], 512 * 1024 * 1024);
  await assert.rejects(hugeShort.run(), /more than deflate can produce/);
  assert.deepStrictEqual(hugeShort.state.bigAllocations, [],
    'an impossible catalog size never allocates the declared 512 MiB');

  const plausibleShort = browserZip([
    { value: new Uint8Array([1, 2, 3]), done: false },
    { value: undefined, done: true },
  ], 1000);
  await assert.rejects(plausibleShort.run(), /inflated 3 bytes/);
  assert.strictEqual(plausibleShort.state.released, true, 'short stream releases its reader');

  const over = browserZip([
    { value: new Uint8Array([1, 2, 3, 4]), done: false },
  ], 3);
  await assert.rejects(over.run(), /inflates past its declared 3 bytes/);
  assert.strictEqual(over.state.cancels, 1, 'overproducing stream is cancelled');
  assert.strictEqual(over.state.released, true, 'overproducing stream releases its reader');

  const errored = browserZip(new Error('synthetic stream failure'), 3);
  await assert.rejects(errored.run(), /synthetic stream failure/);
  assert.strictEqual(errored.state.cancels, 1, 'failed read cancels remaining stream');
  assert.strictEqual(errored.state.released, true, 'failed stream releases its reader');

  const cancelled = browserZip(
    Object.assign(new Error('cancelled by source'), { name: 'AbortError' }), 3);
  await assert.rejects(cancelled.run(), { name: 'AbortError' });
  assert.strictEqual(cancelled.state.cancels, 1, 'cancelled read closes its reader');
  assert.strictEqual(cancelled.state.released, true, 'cancelled operation releases resources');

  const validBytes = new Uint8Array([0x61, 0x62, 0x63]);
  const valid = browserZip([
    { value: validBytes, done: false },
    { value: undefined, done: true },
  ], validBytes.length);
  valid.setCrc(validBytes);
  const result = await valid.run();
  assert.deepStrictEqual(Array.from(result), Array.from(validBytes));
  assert.strictEqual(valid.state.released, true, 'valid stream releases its reader');

  // Exercise real streaming decompression too, while keeping the browser
  // branch isolated from this process's available Node zlib import.
  if (typeof DecompressionStream !== 'undefined') {
    const window = {};
    vm.runInNewContext(source, { window, Blob, DecompressionStream, Uint8Array,
      ArrayBuffer, DataView, TextDecoder, Date, BigInt, console });
    const payload = Buffer.from('streamed ZIP payload\n'.repeat(12000));
    const compressed = require('zlib').deflateRawSync(payload);
    const archive = new Uint8Array(30 + compressed.length);
    archive.set([0x50, 0x4b, 0x03, 0x04]);
    archive.set(compressed, 30);
    const entry = { name: 'valid.bin', method: 8, flags: 0, localHeaderOffset: 0,
      compressedSize: compressed.length, uncompressedSize: payload.length,
      crc: window.ZipMount.crc32(payload) };
    assert.deepStrictEqual(Buffer.from(await window.ZipMount.extractAsync(archive, entry)), payload);
    await assert.rejects(window.ZipMount.extractAsync(archive, { ...entry, crc: entry.crc ^ 1 }), /CRC32/);
  }
  console.log('browser ZIP inflate boundary cases passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
