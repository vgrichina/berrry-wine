#!/usr/bin/env node
'use strict';
// Source/JS contract only: real producer, command queue and worker endpoint;
// mock device records RGBA bindings. No native executor or GPU is created.
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {Bridge} = require('../lib/d3d9-host');
const Worker = require('../lib/d3d9-render-worker');
const {OPCODES: OP} = require('../lib/d3d-command-stream');
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
  return {bridge,endpoint,memory,set,desc,program,mip,texels,record,texture,fill,rgba,commands,observations,instances,draw,drain,
    hold() { hold = deferred(); return () => { hold.resolve(); hold = null; }; }};
}
const level = (draw, stage = 0, mip = 0) => draw.textures[stage][mip];
const pixel = (draw, at = 0, stage = 0) => [...level(draw, stage).pixels.slice(at, at + 4)];


test('single unsigned counter rollover invalidates an observed old generation', async () => {
  const f=fixture();
  try {
    f.set(f.program+25596,0xffffffff);
    assert.equal(f.draw(),1);await f.drain();
    f.fill(f.texels,16384,[71,82,93,255]);
    f.set(f.program+25596,(0xffffffff+1)>>>0);
    assert.equal(f.draw(),1);await f.drain();
    assert.deepEqual(pixel(f.observations[1]),[71,82,93,255]);
  } finally { await f.bridge.close(); }
});
test('an unbound cached mip cannot inherit bytes after a complete allocation-counter cycle', async () => {
  const f=fixture();
  try {
    assert.equal(f.draw(),1);await f.drain();
    const first=level(f.observations[0]);
    // The producer uses i32.add by one after each successful allocation.
    // Summarize 2**32 successful create/release operations without inspecting
    // this mip again. This models their final state, not their execution.
    // The cache is not flushed by RESOURCE_RELEASE of a texture, and may
    // retain this sole 16KiB snapshot while the mip is unbound.
    f.set(f.program+1700,0);
    assert.equal(f.draw(),1);await f.drain();
    const generation=new DataView(f.memory).getUint32(f.program+25596,true);
    f.set(f.program+25596,(generation+2**32)>>>0);
    f.texture(0,f.record,f.texels); // same allocation address/layout/initial seq
    f.fill(f.texels,16384,[71,82,93,255]);
    assert.equal(f.draw(),1);await f.drain();
    assert.deepEqual(pixel(f.observations[2]),[71,82,93,255],
      'replacement texture must publish its current bytes after counter ABA');
    assert.notEqual(level(f.observations[2]).key,first.key);
  } finally { await f.bridge.close(); }
});
