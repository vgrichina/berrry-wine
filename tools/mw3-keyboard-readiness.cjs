'use strict';

// Serialize/install before instantiation in the verified owning Worker. This
// diagnostic has its own single bounded API-log window; do not start/stop a
// second API-log owner concurrently. It never authorizes or injects input.
function attach(table, {getExports, memory, sample, readCompletion, layout,
    capacity = 64} = {}) {
  if (![getExports, sample, readCompletion].every(f => typeof f === 'function') ||
      !memory?.buffer || !Number.isInteger(capacity) || capacity < 1 || capacity > 256)
    throw Error('bounded readiness binding required');
  const names = ['log', 'log_i32', 'log_api_exit'];
  for (const name of names) if (typeof table[name] !== 'function') throw Error('missing ' + name);
  const originals = new Map(), wrappers = new Map(), rows = new Map();
  let ex, active = false, used = false, prior = 0, expires = 0, marker = -1;
  let frames = [], errors = [], drops = 0, entries = 0, exits = 0;
  const halt = error => {
    if (error && errors.length < 8) errors.push(String(error));
    if (active) { active = false; ex.set_api_log(prior); }
  };
  const p = (a, n = 4) => {
    if (!Number.isInteger(a) || a <= 0 || a + n > 0x100000000) throw Error('readiness guest address');
    const w = ex.guest_to_wasm(a) >>> 0;
    if (w <= 0xf0 || w + n > memory.buffer.byteLength) throw Error('readiness translation');
    return w;
  };
  const u = a => new DataView(memory.buffer).getUint32(p(a), true);
  const words = (a, n) => Array.from({length:n}, (_, i) => u(a + i * 4));
  const signature = (a, bytes) => {
    const actual = new Uint8Array(memory.buffer, p(a, bytes.length), bytes.length);
    if (bytes.some((v, i) => actual[i] !== v)) throw Error('readiness original code mismatch');
  };
  function request(category) {
    if (category !== 'com:1094' && category !== 'name:IDirectInputDevice_GetDeviceData') return null;
    const esp = ex.get_esp() >>> 0;
    if (u(esp) !== 0x4f7ae0) return null;
    signature(0x4f7aa0, [0x83,0xec,8,0x53,0x55,0x56,0x57,0x89,0x4c,0x24,0x14,
      0xc7,0x44,0x24,0x10,1,0,0,0,0x33,0xf6,0xe8,0x56,0xfb,0xff,0xff]);
    signature(0x4f7add, [0xff,0x51,0x28,0x85,0xc0,0x8b,0x4c,0x24,0x10]);
    const gate = sample(category, ex, memory, layout);
    if (gate?.deviceType !== 1) throw Error('readiness keyboard required');
    const r = {api:'IDirectInputDevice_GetDeviceData', requestEsp:esp,
      returnAddress:u(esp), thisPtr:u(esp+4), stride:u(esp+8), buffer:u(esp+12),
      countPtr:u(esp+16), flags:u(esp+20), requested:u(u(esp+16)),
      objectsBase:layout.objectsBase, objectsSize:layout.objectsSize,
      blocking:u(esp+44), outerCaller:u(esp+48), gate};
    if (r.stride !== 16 || r.requested > 1 || r.flags !== 0) throw Error('readiness request shape');
    if (r.outerCaller === 0x56340b) {
      signature(0x5633f0, [0x53,0x56,0x8b,0xf1,0x57,0x8b,0x46,0x18,0x85,0xc0,
        0x75,8,0x32,0xc0,0x5f,0x5e,0x5b,0xc2,8,0,0x33,0xc9,0xe8,0x95,0x46,0xf9,0xff]);
      const owner = u(esp+28), node = u(owner+0x18), vtable = node ? u(node) : 0;
      r.sequence = {owner, node, vtable, step:vtable ? u(vtable+4) : 0,
        next:node ? u(node+4) : 0, wrapperCaller:u(esp+64),
        startWords:words(owner+8,2), nowWords:words(esp+68,2),
        nodeWords:node ? words(node,12) : []};
      if (r.sequence.wrapperCaller === 0x5634ef) {
        signature(0x5634c0,[0x83,0xec,8,0x56,0x8b,0xf1,0xff,0x15,0x1c,0x67,0x58,0]);
        r.sequence.controllerCaller=u(esp+88);
        r.sequence.tickWords=words(esp+80,2);
      }
      if (r.sequence.step === 0x563b90 && u(node+0x10))
        r.sequence.movieRateWord=u(u(node+0x10)+0xec);
    }
    return r;
  }
  function complete(r) {
    const raw = {request:r, at:Date.now(), mono:performance.now(),
      eax:ex.get_eax()>>>0, esp:ex.get_esp()>>>0, count:u(r.countPtr)};
    // Retain invalid/unsuccessful raw returns even when decoding rejects them.
    let failure;
    try {
      if (raw.esp !== r.requestEsp+24) throw Error('readiness stdcall return');
      raw.decoded = readCompletion(ex,memory,r);
    } catch (error) { failure=error; }
    const key = JSON.stringify([r.thisPtr,r.stride,r.buffer,r.countPtr,r.flags,r.requested,
      r.blocking,r.outerCaller,r.gate,r.sequence?.owner,r.sequence?.node,r.sequence?.step,
      raw.eax,raw.count,raw.decoded?.records.map(e=>[e.offset,e.data])]);
    let row = rows.get(key);
    if (!row) {
      if (rows.size === capacity) { drops++; throw Error('readiness capacity'); }
      row = {count:0, first:raw, last:raw}; rows.set(key,row);
    }
    row.count++; row.last = raw;
    if(failure) throw failure;
  }
  for (const name of names) {
    const original = table[name]; originals.set(name, original);
    const wrapped = function(...args) {
      if (active && performance.now() >= expires) halt();
      if (active) try {
        if (getExports() !== ex) throw Error('readiness exports replaced');
        if (name === 'log_i32' && (args[0]>>>16) === 0xc0de) marker=args[0]&65535;
        if (name === 'log') {
          if (frames.length === 64) { drops++; throw Error('readiness depth'); }
          let category = marker < 0 ? 'unclassified' : 'com:'+marker; marker=-1;
          if (category === 'unclassified' && args[1]>0 && args[1]<=96)
            category='name:'+String.fromCharCode(...new Uint8Array(memory.buffer,args[0],args[1]));
          frames.push(request(category)); entries++;
        }
      } catch (error) { halt(error); }
      let value;
      try { value=original.apply(this,args); }
      catch (error) { halt('original import threw: '+name); throw error; }
      if (active && name === 'log_api_exit') try {
        if (!frames.length) throw Error('readiness unmatched exit');
        exits++; const r=frames.pop(); if(r) complete(r);
      } catch(error) { halt(error); }
      return value;
    };
    table[name]=wrapped; wrappers.set(name,wrapped);
  }
  return {
    start({durationMs=5000,apiLogBefore}={}) {
      if (used || ![0,1].includes(apiLogBefore) || !Number.isInteger(durationMs) ||
          durationMs<1 || durationMs>45000) throw Error('single bounded readiness start required');
      ex=getExports(); prior=apiLogBefore; used=true;
      expires=performance.now()+durationMs; ex.set_api_log(1); active=true;
    },
    snapshot() {
      if(active && performance.now()>=expires) halt();
      return {active,expires,drops,errors:errors.slice(),pending:frames.length,entries,exits,
        conflicts:[...names.filter(n=>table[n]!==wrappers.get(n)),
          ...(ex && getExports()!==ex ? ['exports'] : [])],
        rows:JSON.parse(JSON.stringify([...rows.values()])),
        meaning:'bounded first/last keyboard returns and original caller frames; no input admission or full chronology'};
    },
    stop() {halt(); return this.snapshot();},
    restore() {
      halt(); const conflicts=[];
      for(const n of names) {if(table[n]===wrappers.get(n))table[n]=originals.get(n);else conflicts.push(n);}
      return {conflicts,capturedWrappersInert:true};
    },
  };
}
module.exports={attach};
