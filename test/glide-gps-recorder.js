'use strict';
// Recording host for the Glide ABI tests (test-glide-abi.js, test-glide3-abi.js).
//
// tl;dr: implements host.gpu_stream_kick(ring, mode) the way the local route
// in lib/gpu-stream-host.js (api 'glide') does (GpuStream.drain into an executor), but the
// executor only RECORDS: every decoded record (op name, fields, trailing bytes
// and the arena bytes it reads, copied at drain time) plus the sticky state a
// DRAW_UP executes under. A NullExecutor runs alongside to validate resource
// lifetimes, so a WAT id bug fails the test. No renderer participates.
//
// Switches:
//   noExecutor   kick returns 0 without draining (no executor can exist).
//   failDrain    the executor throws; drain stores error_seq/error_code in the
//                ring and the kick returns 0, as worker RPC turns a host error
//                into a zero result.
//   readbackFill byte every READBACK destination is filled with.
const GS = require('../lib/gpu-stream');

const PRIM_VERTS = { [GS.CONST.PRIM_POINTLIST]: 1, [GS.CONST.PRIM_LINELIST]: 2, [GS.CONST.PRIM_TRIANGLELIST]: 3 };
// The old Glide wire ops, which the tests still name primitives by.
const PRIM_OP = { [GS.CONST.PRIM_POINTLIST]: 12, [GS.CONST.PRIM_LINELIST]: 11, [GS.CONST.PRIM_TRIANGLELIST]: 5 };

function createGpsRecorder(memory) {
  const r = {
    noExecutor: false,
    failDrain: false,
    readbackFill: 0x5a,
    kicks: [],      // { mode, records: [...] } in call order
    records: [],    // every executed record, in order
    textures: new Map(),  // id -> { kind, fmt, width, height, levels, data: [Uint32Array per level] }
    samplers: new Map(),  // id -> SAMPLER fields
    shaders: new Map(),   // id -> Buffer (IR)
    state: null,
    null: new GS.NullExecutor(),
    ringAddr: 0,
  };
  const resetState = () => { r.state = { raster: null, consts: null, bind: [], targets: null, viewport: null }; };
  resetState();

  function copy(u8) { return Buffer.from(u8); }

  const executor = {
    execute(rec) {
      if (r.failDrain) throw new Error('recorder: injected executor failure');
      r.null.execute(rec);
      const f = Object.assign({}, rec.fields);
      const out = { name: rec.name, op: rec.op, seq: rec.seq, flags: rec.flags, fields: f, tail: copy(rec.tail) };
      switch (rec.op) {
        case GS.OP.CREATE: {
          const levels = Math.max(1, f.levels);
          const data = [];
          for (let l = 0, w = f.width, h = f.height; l < levels; l++, w = Math.max(1, w >> 1), h = Math.max(1, h >> 1))
            data.push(new Uint32Array(w * h));
          r.textures.set(f.id, { kind: f.kind, fmt: f.fmt, width: f.width, height: f.height, levels, data });
          break;
        }
        case GS.OP.RELEASE: r.textures.delete(f.id); r.samplers.delete(f.id); r.shaders.delete(f.id); break;
        case GS.OP.UPLOAD: {
          out.data = copy(rec.arena(f.src, f.bytes));
          const t = r.textures.get(f.id);
          if (t && t.data[f.level]) {
            const lw = Math.max(1, t.width >> f.level);
            const dv = new DataView(out.data.buffer, out.data.byteOffset, out.data.length);
            for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++)
              t.data[f.level][(f.y + y) * lw + f.x + x] = dv.getUint32(y * f.pitch + x * 4, true);
          }
          break;
        }
        case GS.OP.SAMPLER: r.samplers.set(f.id, f); break;
        case GS.OP.SHADER: r.shaders.set(f.id, copy(GS.shaderIR(rec))); break;
        case GS.OP.TARGETS: r.state.targets = f; break;
        case GS.OP.VIEWPORT: r.state.viewport = f; break;
        case GS.OP.RASTER: r.state.raster = f; break;
        case GS.OP.CONSTS: r.state.consts = Array.from(GS.decodeConsts(rec)); break;
        case GS.OP.BIND: r.state.bind = GS.decodeBind(rec).map(e => ({ slot: e.slot, texture: e.texture, sampler: e.sampler,
          samplerFields: r.samplers.get(e.sampler) })); break;
        case GS.OP.DRAW_UP: {
          out.data = copy(rec.arena(f.voff, f.count * f.stride));
          const dv = new DataView(out.data.buffer, out.data.byteOffset, out.data.length);
          out.vertices = [];
          for (let i = 0; i < f.count; i++)
            out.vertices.push(Array.from({ length: f.stride / 4 }, (_, k) => dv.getFloat32(i * f.stride + k * 4, true)));
          out.state = { raster: r.state.raster, consts: r.state.consts, bind: r.state.bind, targets: r.state.targets, ps: f.ps };
          break;
        }
        case GS.OP.READBACK:
          // NullExecutor zero-filled it; the "host" answers with a known byte.
          for (const ref of rec.refs) rec.arena(ref.pos, ref.len).fill(r.readbackFill);
          break;
        default: break;
      }
      r.records.push(out);
      r.current.records.push(out);
    },
  };

  r.kick = (ring, mode) => {
    ring >>>= 0;
    const k = { mode, records: [] };
    r.kicks.push(k);
    r.current = k;
    if (r.noExecutor) return 0;
    r.ringAddr = ring;
    const R = new GS.Ring(() => memory.buffer, ring);
    try {
      GS.drain([R], executor);
    } catch (error) {
      if (r.failDrain) return 0;
      throw error;
    }
    if (mode === GS.CONST.KICK_CLOSE) { r.null = new GS.NullExecutor(); r.textures.clear(); r.samplers.clear(); r.shaders.clear(); resetState(); }
    return 1;
  };

  // Records executed since `from` (an index into r.records).
  r.since = from => r.records.slice(from);
  r.mark = () => ({ records: r.records.length, kicks: r.kicks.length });
  r.kicksSince = m => r.kicks.slice(m.kicks);
  r.recordsSince = m => r.records.slice(m.records);
  return r;
}

// Expand DRAW_UP records into one entry per primitive: { op (old wire op
// 5/11/12), prim, verts: [vertex floats...], state, ps }.
function primitives(records) {
  const out = [];
  for (const rec of records) {
    if (rec.name !== 'DRAW_UP') continue;
    const n = PRIM_VERTS[rec.fields.prim];
    if (!n) throw new Error('unexpected DRAW_UP prim ' + rec.fields.prim);
    if (rec.fields.count % n) throw new Error(`DRAW_UP count ${rec.fields.count} is not a multiple of ${n}`);
    for (let i = 0; i < rec.fields.count; i += n)
      out.push({ op: PRIM_OP[rec.fields.prim], prim: rec.fields.prim, verts: rec.vertices.slice(i, i + n), state: rec.state, ps: rec.fields.ps, seq: rec.seq });
  }
  return out;
}

// Read a GpsRing header word (by field name) at wasm address `ring`.
function ringWord(memory, ring, name) {
  const f = GS.LAYOUTS.GpsRing.fields.find(x => x.name === name);
  return new DataView(memory.buffer).getUint32(ring + f.offset, true);
}

module.exports = { createGpsRecorder, primitives, ringWord, GS };
