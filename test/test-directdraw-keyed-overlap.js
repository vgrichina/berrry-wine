#!/usr/bin/env node
'use strict';

// Published COM vtables in the complete production WAT closure. Literal
// snapshot-source matrices cover keyed overlap, packed pixels and clipping.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createHostImports } = require('../lib/host-imports');
const regions = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');

(async () => {
  const wasm = process.argv[2] ? fs.readFileSync(process.argv[2])
    : require('./compile-src').compileSrcWasm();
  console.log('module sha256', crypto.createHash('sha256').update(wasm).digest('hex'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {},
    guestNowMs: () => 1234, realNowMs: () => 1234,
    wallNowMs: () => 1795478400000, pitNowMs: () => 1234 });
  imports.host.memory = memory;
  const { instance: { exports: e } } = await WebAssembly.instantiate(wasm, imports);
  const pe = fs.readFileSync(path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length));
  e.init_dx_com_thunks();
  const read = p => e.guest_read32(p) >>> 0;
  const write = (p, n) => e.guest_write32(p, n >>> 0);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const snapshot = (p, n) => Array.from({ length: n }, (_, i) => e.guest_read8(p + i));
  const fill = (p, n, value) => { for (let i = 0; i < n; i++) e.guest_write8(p + i, value); };
  const stack = alloc(8192) + 4096;
  let calls = 0;
  function invoke(args, object, slot, target) {
    const code = [], word = n => code.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24);
    for (const arg of args.slice().reverse()) { code.push(0x68); word(arg); }
    if (object) {
      assert(read(read(object) + slot * 4), 'published COM method');
      code.push(0xb8); word(object);
      code.push(0x8b, 0x00, 0xff, 0x90); word(slot * 4);
    } else { code.push(0xb8); word(target); code.push(0xff, 0xd0); }
    const result = alloc(8);
    code.push(0xa3); word(result);
    code.push(0x89, 0x25); word(result + 4); code.push(0xc3);
    const pc = alloc(code.length);
    code.forEach((b, i) => e.guest_write8(pc + i, b));
    e.set_esp(stack); e.call_func(pc, 0, 0, 0, 0);
    for (let n = 0; n < 100 && e.get_eip(); n++) e.run(10000);
    assert.equal(e.get_eip(), 0, 'bounded guest return');
    assert.equal(read(result + 4), stack - 20, 'exact COM stdcall cleanup');
    assert.equal(e.get_esp() >>> 0, stack - 16, 'caller RET');
    calls++;
    return read(result);
  }
  const com = (obj, slot, ...args) => invoke([obj, ...args], obj, slot);
  const ok = hr => assert.equal(hr, 0);
  const guid = words => { const p = alloc(16); words.forEach((n, i) => write(p + i * 4, n)); return p; };
  const iid7 = guid([0x15e65ec0, 0x11d23b9c, 0x60002fb9, 0x5bea9797]);
  const out = alloc(4), dv = new DataView(memory.buffer);
  const thunkWa = regions.BASE.THUNK_BASE;
  const thunk = (thunkWa - e.get_guest_base() + e.get_image_base()) >>> 0;
  const saved = dv.getUint32(thunkWa + 4, true);
  try {
    dv.setUint32(thunkWa + 4, apis.find(a => a.name === 'DirectDrawCreateEx').id, true);
    ok(invoke([0, out, iid7, 0], 0, 0, thunk));
  } finally { dv.setUint32(thunkWa + 4, saved, true); }
  const dd = read(out); assert(dd); ok(com(dd, 20, 0, 8));
  // Frozen literal oracle: source pixels are read as they stood before the call.
  const beforePixels = [[1,0,3,4,5],[6,7,0,9,10],[11,12,13,0,15],[16,17,18,19,20]];
  const vectors = [
  {
    "name": "fast-right-packed",
    "method": 7,
    "dr": [
      1,
      0
    ],
    "sr": [
      0,
      0,
      4,
      4
    ],
    "want": [
      [
        1,
        1,
        3,
        3,
        4
      ],
      [
        6,
        6,
        7,
        9,
        9
      ],
      [
        11,
        11,
        12,
        13,
        15
      ],
      [
        16,
        16,
        17,
        18,
        19
      ]
    ]
  },
  {
    "name": "fast-down-right-clipped",
    "method": 7,
    "dr": [
      1,
      1
    ],
    "sr": [
      0,
      0,
      5,
      4
    ],
    "want": [
      [
        1,
        0,
        3,
        4,
        5
      ],
      [
        6,
        1,
        0,
        3,
        4
      ],
      [
        11,
        6,
        7,
        0,
        9
      ],
      [
        16,
        11,
        12,
        13,
        20
      ]
    ]
  },
  {
    "name": "blt-negative-left-down",
    "method": 5,
    "dr": [
      -1,
      1,
      4,
      5
    ],
    "sr": [
      0,
      0,
      5,
      4
    ],
    "want": [
      [
        1,
        0,
        3,
        4,
        5
      ],
      [
        6,
        3,
        4,
        5,
        10
      ],
      [
        7,
        12,
        9,
        10,
        15
      ],
      [
        12,
        13,
        18,
        15,
        20
      ]
    ]
  },
  {
    "name": "fast-up-left-control",
    "method": 7,
    "dr": [
      0,
      0
    ],
    "sr": [
      1,
      1,
      5,
      4
    ],
    "want": [
      [
        7,
        0,
        9,
        10,
        5
      ],
      [
        12,
        13,
        0,
        15,
        10
      ],
      [
        17,
        18,
        19,
        20,
        15
      ],
      [
        16,
        17,
        18,
        19,
        20
      ]
    ]
  }
];
  const width = 5, height = 4, guard = 32, failures = [];
  let cases = 0, blits = 0, keySetup = 0, releases = 0;
  const rect = values => { const p = alloc(16); values.forEach((v,i) => write(p+4*i,v)); return p; };
  for (const bpp of [8,16,24,32]) {
    const bps=bpp/8, pitch=width*bps+5, size=pitch*height;
    const base=alloc(size+2*guard), pixels=base+guard, desc=alloc(124);
    fill(base,size+2*guard,0xa7); fill(desc,124,0);
    for (const [o,v] of [[0,124],[4,0x180f],[8,height],[12,width],[16,pitch],[36,pixels],
      [72,32],[76,bpp===8?0x60:0x40],[84,bpp],
      [88,bpp===16?0xf800:bpp===8?0:0xff0000],
      [92,bpp===16?0x7e0:bpp===8?0:0xff00],
      [96,bpp===16?0x1f:bpp===8?0:0xff],[104,0x840]]) write(desc+o,v);
    ok(com(dd,6,desc,out,0)); const obj=read(out); assert(obj);
    write(desc,124); ok(com(obj,25,0,desc,1,0));
    assert.equal(read(desc+36),pixels); assert.equal(read(desc+16),pitch);
    ok(com(obj,32,0));
    const key=alloc(8); write(key,0); write(key+4,0);
    ok(com(obj,29,8,key)); keySetup++; // DDCKEY_SRCBLT, exact zero key
    for (const c of vectors) {
      fill(base,size+2*guard,0xa7);
      const want=new Array(size+2*guard).fill(0xa7);
      for(let y=0;y<height;y++) for(let x=0;x<width;x++) for(let b=0;b<bps;b++) {
        // Replicated byte lanes exercise all bytes without a format conversion oracle.
        e.guest_write8(pixels+y*pitch+x*bps+b,beforePixels[y][x]);
        want[guard+y*pitch+x*bps+b]=c.want[y][x];
      }
      const sr=rect(c.sr);
      const hr=c.method===7 ? com(obj,7,...c.dr,obj,sr,1)
        : com(obj,5,rect(c.dr),obj,sr,0x01008000,0);
      ok(hr); blits++;
      const got=snapshot(base,size+2*guard);
      const mismatch=got.findIndex((v,i)=>v!==want[i]);
      if(mismatch!==-1) failures.push({name:c.name,bpp,byte:mismatch,got:got[mismatch],want:want[mismatch]});
      // Check safety separately even when the pixel regression fails.
      assert.deepEqual(got.slice(0,guard),want.slice(0,guard),'prefix canary');
      assert.deepEqual(got.slice(guard+size),want.slice(guard+size),'suffix canary');
      for(let y=0;y<height;y++) assert.deepEqual(
        got.slice(guard+y*pitch+width*bps,guard+(y+1)*pitch),new Array(5).fill(0xa7),'row padding');
      cases++;
    }
    com(obj,2); releases++;
  }
  com(dd,2); releases++;
  assert.equal(cases,16); assert.equal(blits,16); assert.equal(keySetup,4); assert.equal(releases,5);
  assert.equal(calls,39,'all COM calls including setup and cleanup');
  console.log(JSON.stringify({cases,blits,keySetup,releases,calls,failures},null,2));
  assert.equal(failures.length,0,'literal immutable-source pixels, guards and row padding');
  console.log('PASS production COM keyed overlap and paired clipping at 8/16/24/32 bpp');
})().catch(error => { console.error(error.stack || error); process.exitCode=1; });
