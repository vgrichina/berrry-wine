#!/usr/bin/env node
'use strict';
// Source/JS contract only: real producer, command queue and worker endpoint;
// mock device records RGBA bindings. No native executor or GPU is created.
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {Bridge} = require('../lib/d3d9-host');
const Worker = require('../lib/d3d9-render-worker');
const {OPCODES: OP} = require('../lib/d3d-command-stream');
// Uploads decode through the WAT decoder (GPU stream v2 slice 9.1), here its
// standalone build. Content identity is WAT's seq stamp, not the bytes: a
// write the guest makes is always followed by $d3d9_texture_touch (Unlock,
// AddDirtyRect, UpdateTexture...), modelled below by stamp().
require('./helpers/wat-texture-decoder').installStandalone();
let stampSerial = 0x1000;
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };

function fixture(options = {}) {
  const memory = new ArrayBuffer(262144), view = new DataView(memory);
  const desc = 64, program = 1024, record = 40000, texels = 50000, mip = record + 64;
  const set = (p, n) => view.setUint32(p, n, true);
  [7, program, 32000, 2, 2, 1, 4, 1, 30000, 16].forEach((n, i) => set(desc + i * 4, n));
  set(program + 12, 0x42); view.setFloat32(program + 1696, 1, true);
  const texture = (stage, at, bits, width = 64, height = 64) => {
    set(program + 1700 + stage * 4, at);
    for (const [offset, value] of [[12,3],[24,width],[28,height],[32,1],[36,21],
      [64,width],[68,height],[72,width*4],[76,width*height*4],[80,bits],[92,1]]) set(at + offset, value);
  };
  texture(0, record, texels);
  const rgba = [10,20,30,255];
  const fill = (bits, bytes, color) => {
    const dest = new Uint8Array(memory, bits, bytes);
    for (let i = 0; i < bytes; i += 4) dest.set([color[2],color[1],color[0],color[3]], i);
  };
  fill(texels, 16384, rgba);
  const observations = [], commands = [], instances = [];
  class MockDevice {
    constructor() { this.levels = new Map(); this.destroyed = false; instances.push(this); }
    execute(command) {
      const p = command.payload;
      assert.equal(this.destroyed, false, 'no command executes after device destruction');
      if (command.opcode === OP.DRAW) {
        for (const key of p.textureReleases || []) this.levels.delete(key);
        const textures = p.textures.map(texture => texture && texture.levels.map(level => {
          if (level.pixels && level.key) this.levels.set(level.key, level.pixels.slice());
          const pixels = level.key ? this.levels.get(level.key) : level.pixels;
          assert(pixels, 'every queued reference has a definition in its device');
          return {key: level.key, pixels: pixels.slice()};
        }));
        observations.push({deviceId:command.deviceId, generation:command.generation, textures});
      } else if (command.opcode === OP.RESOURCE_RELEASE && p.kind === 'device') this.destroy();
      else if (command.opcode === OP.RESOURCE_UPDATE && p.kind === 'reset') this.levels.clear();
      return {value:1, complete:true};
    }
    destroy() { this.levels.clear(); this.destroyed = true; }
  }
  const endpoint = Worker.create({instance:{exports:{}}, memory:{buffer:memory}, backend:'software',
    options:{SoftwareDevice:MockDevice}});
  let hold = null, serial = Promise.resolve();
  const consumer = {ready:Promise.resolve(), execute(command) {
    commands.push(command);
    const gate = command.opcode === OP.DRAW && hold;
    const result = serial.then(async () => { if (gate) await gate.promise; return endpoint.execute(command); });
    serial = result.then(() => {}, () => {});
    return result;
  }, cancel() { hold?.resolve(); endpoint.destroy(); }};
  const bridge = new Bridge({backend:'software',createSoftwareWorker:()=>consumer,
    getMemory:()=>memory,guestToWasm:p=>p,...options});
  const draw = () => bridge.call(0x30001, desc, 0);
  const drain = async () => {
    for (const entry of bridge.devices.values()) await entry.queue.fence();
    await serial; await tick();
  };
  const stamp = (at = mip) => set(at + 28, ++stampSerial);
  return {bridge,endpoint,memory,set,desc,program,mip,texels,record,texture,fill,rgba,commands,observations,instances,draw,drain,stamp,
    hold() { hold = deferred(); return () => { hold.resolve(); hold = null; }; }};
}
const level = (draw, stage = 0, mip = 0) => draw.textures[stage][mip];
const pixel = (draw, at = 0, stage = 0) => [...level(draw, stage).pixels.slice(at, at + 4)];


test('a clean level is not re-decoded; a stamped change in the last byte is', async () => {
  const f=fixture();
  try {
    assert.equal(f.draw(),1);await f.drain();
    const before=level(f.observations[0]);
    new Uint8Array(f.memory,f.texels+16383,1)[0]=17;
    // No stamp: WAT says the level is clean, so the resident key is reused.
    assert.equal(f.draw(),1);await f.drain();
    assert.equal(level(f.observations[1]).key,before.key);
    f.stamp();
    assert.equal(f.draw(),1);await f.drain();
    assert.deepEqual(pixel(f.observations[2],16380),[10,20,30,17]);
    assert.notEqual(level(f.observations[2]).key,before.key);
    assert.deepEqual([...before.pixels.slice(-4)],[10,20,30,255]);
  } finally {await f.bridge.close();}
});
test('stamped replacement queued behind the old draw owns fresh immutable bytes', async () => {
  const f=fixture();
  try {
    const resume=f.hold();
    assert.equal(f.draw(),1);
    f.fill(f.texels,16384,[71,82,93,255]);f.stamp();
    assert.equal(f.draw(),1);
    new Uint8Array(f.memory,f.texels,16384).fill(0);
    resume();await f.drain();
    assert.deepEqual(f.observations.map(d=>pixel(d)),[f.rgba,[71,82,93,255]]);
    assert.notEqual(level(f.observations[0]).key,level(f.observations[1]).key);
  } finally {await f.bridge.close();}
});
test('the snapshot LRU holds decoded RGBA only (no source copy); resident budget counts RGBA', async () => {
  const f=fixture({maxTextureSnapshotBytes:16384,maxResidentTextureBytes:16384});
  try {
    assert.equal(f.draw(),1);await f.drain();
    let snap=f.bridge._textureSnapshots.get(f.mip);
    assert.equal(f.bridge._textureSnapshotBytes,16384);
    assert.equal(snap.cacheBytes,16384);assert.equal(snap.bytes,16384);
    assert.equal(snap.source,undefined,'no guest source copy is retained');
    assert.equal(f.bridge.devices.get(7).residentBytes,16384);
    f.texture(0,100000,120000);f.fill(120000,16384,[71,82,93,255]);
    assert.equal(f.draw(),1);await f.drain();
    assert.equal(f.bridge._textureSnapshots.size,1);
    assert(!f.bridge._textureSnapshots.has(f.mip));
    assert.equal(f.bridge._textureSnapshotBytes,16384);
    assert.equal(f.bridge.devices.get(7).residentBytes,16384);
  } finally {await f.bridge.close();}
  const small=fixture({maxTextureSnapshotBytes:16383});
  try {
    assert.equal(small.draw(),1);await small.drain();
    assert.equal(small.bridge._textureSnapshots.size,0);
    assert.equal(small.bridge._textureSnapshotBytes,0);
    assert.deepEqual(pixel(small.observations[0]),small.rgba);
  } finally {await small.bridge.close();}
});
for (const [format,bytes,initial,replacement,expected] of [
  [23,8192,[0,0],[255,255],[255,255,255,255]],
  [50,4096,[0],[71],[71,71,71,255]],
  [0x31545844,2048,[0,0,0,0,0,0,0,0],[255,255,0,0,0,0,0,0],[255,255,255,255]]
]) test(`stamped content identity covers format ${format}`, async () => {
  const f=fixture();
  try {
    f.set(f.record+36,format);f.set(f.mip+12,bytes);f.set(f.mip+8,bytes/(format===0x31545844?16:64));
    const src=new Uint8Array(f.memory,f.texels,bytes);
    for(let i=0;i<bytes;i+=initial.length)src.set(initial,i);
    assert.equal(f.draw(),1);await f.drain();
    const old=level(f.observations[0]).key;
    for(let i=0;i<bytes;i+=replacement.length)src.set(replacement,i);
    f.stamp();
    assert.equal(f.draw(),1);await f.drain();
    assert.deepEqual(pixel(f.observations[1]),expected);
    assert.notEqual(level(f.observations[1]).key,old);
  } finally {await f.bridge.close();}
});
