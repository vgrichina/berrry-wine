'use strict';
// Real Device + WebGLBackend cache, mocked allocation/GL boundary only.
const assert = require('assert');
const cp = require('child_process');
const Module = require('module');
const path = require('path');
if (process.argv.includes('--mutation')) {
  const filename = path.resolve(__dirname, '../lib/d3d9-backend.js');
  const m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths;
  // That historical backend requires its retained JS fixed compiler, which
  // slice 9.2 deleted from the tree: load it from the same revision.
  m.require = id => {
    if (id !== './d3d9-fixed') return Module.prototype.require.call(m, id);
    const fixedName = path.resolve(__dirname, '../lib/d3d9-fixed.js'), f = new Module(fixedName, m);
    f.filename = fixedName; f.paths = module.paths;
    f._compile(cp.execFileSync('git', ['show', 'ffe822a9d50ad79439330609915eb84475acd2bc:lib/d3d9-fixed.js'],
      {stdio:['ignore','pipe','ignore'], maxBuffer:1 << 20}).toString(), fixedName);
    return f.exports;
  };
  m._compile(cp.execFileSync('git', ['show',
    'ffe822a9d50ad79439330609915eb84475acd2bc:lib/d3d9-backend.js'],
    {stdio:['ignore','pipe','ignore'], maxBuffer:131072}).toString(), filename);
  require.cache[filename] = m;
}
const {Device} = require('../lib/d3d9-backend');
const {WebGLBackend} = require('../lib/gpu-backend');
const Clear = require('../lib/render-clear');
function fixture() {
  const g = Object.create(WebGLBackend.prototype);
  const writes = [], clears = [], bindings = [];
  const state = {depth:1, stencil:0, colorMask:[true,true,true,true]};
  g.canvas = {width:4,height:4}; g._stateValues = new Map();
  g.gl = {SCISSOR_TEST:1, COLOR_BUFFER_BIT:2, DEPTH_BUFFER_BIT:4, STENCIL_BUFFER_BIT:8,
    clearDepth(z) {state.depth=z; writes.push(z);},
    clearStencil(s) {state.stencil=s;},
    clear(mask) {clears.push({...state, colorMask:[...state.colorMask], mask});},
    colorMask(...v) {state.colorMask=v;}, clearColor() {}, depthMask() {}, stencilMask() {},
    enable() {}, disable() {}, scissor(...v) {state.scissor=v;}};
  g.bindRenderTarget = (...v) => bindings.push(['default',...v]);
  g.bindColorResource = (...v) => bindings.push(['named',...v]);
  const d = Object.create(Device.prototype);
  d.gpu=g; d.colorTargets=new Map(); d.depthTargets=new Map();
  return {g,d,writes,clears,bindings,state};
}
const {g,d,writes,clears,bindings,state} = fixture();
const command = p => d.clearCommand(structuredClone(Clear.create({color:[1,0,0,1],flags:2,...p},4,4)));
for (const depth of [.25,.5,.5,.25,.25]) {
  command({depth});
  assert.strictEqual(clears.at(-1).depth,depth,'normalized depth at actual gl.clear');
  assert.deepStrictEqual(g._stateValues.get('clearDepth'),[depth]);
}
assert.deepStrictEqual(writes,[.25,.5,.25],'repeated values use the existing wrapper cache');
// A different API frontend can change clear values between D3D9 clears.
g.clear(null,0,.875,17);
command({depth:.25});
assert.strictEqual(clears.at(-1).depth,.25);
assert.deepStrictEqual(g._stateValues.get('clearDepth'),[.25]);
d.clear([0,0,0,0],2); // positional default depth
assert.strictEqual(clears.at(-1).depth,1);
command({}); // descriptor default depth
assert.strictEqual(clears.at(-1).depth,1);
g.clear(null,0,.625);
command({flags:1,depthAttachment:null,colorMask:5});
assert.strictEqual(clears.at(-1).mask,2);
assert.deepStrictEqual(clears.at(-1).colorMask,[true,false,true,false]);
assert.deepStrictEqual(g._stateValues.get('clearDepth'),[1]);
g.setColorMask(true,true,true,true);
assert.deepStrictEqual(state.colorMask,[true,true,true,true]);
command({flags:1,colorMask:10});
assert.deepStrictEqual(clears.at(-1).colorMask,[false,true,false,true]);
for (let mask=0;mask<16;mask++) {
  command({flags:1,colorMask:mask});
  assert.deepStrictEqual(clears.at(-1).colorMask,[1,2,4,8].map(bit=>!!(mask&bit)));
}
const color = {id:7,width:4,height:4,format:22};
const depth = {id:11,width:4,height:4,format:75};
d.colorTargets.set(7,{...color,revision:1});
command({depth:.5,depthAttachment:depth,colorAttachment:color});
assert.strictEqual(bindings.at(-1)[0],'named');
assert.strictEqual(clears.at(-1).depth,.5);
assert.deepStrictEqual(g._stateValues.get('clearDepth'),[.5]);
command({flags:4,stencil:0x1234,depthAttachment:depth,colorAttachment:color});
assert.strictEqual(clears.at(-1).mask,8);
assert.strictEqual(clears.at(-1).stencil,0x34);
assert.deepStrictEqual(g._stateValues.get('clearStencil'),[0x34]);
command({flags:7,depth:.125,stencil:255,depthAttachment:depth,colorAttachment:color});
assert.strictEqual(clears.at(-1).mask,14);
assert.strictEqual(clears.at(-1).depth,.125);
assert.strictEqual(clears.at(-1).stencil,255);
g.clear(null,0,1,17);
command({flags:4,stencil:0x1234,depthAttachment:depth});
assert.strictEqual(clears.at(-1).stencil,0x34);
assert.deepStrictEqual(g._stateValues.get('clearStencil'),[0x34]);
command({flags:0,depthAttachment:null});
assert.strictEqual(clears.at(-1).mask,0,'zero flags write no attachment');
const count=clears.length;
command({rects:[[1,1,1,2]]});
assert.strictEqual(clears.length,count,'empty regions never call gl.clear');
assert.throws(()=>command({depthAttachment:null}),/depth/);
assert.strictEqual(clears.length,count,'absent required depth rejects before clearing');
// Public wrapper defaults and explicit depth still work after adapter calls.
g.clear(null,4,.375); assert.strictEqual(clears.at(-1).depth,.375);
g.clear(null,4); assert.strictEqual(clears.at(-1).depth,1);
assert.deepStrictEqual(g._stateValues.get('clearDepth'),[1]);
if (!process.argv.includes('--mutation')) {
  const r=cp.spawnSync(process.execPath,['--max-old-space-size=256',__filename,'--mutation'],
    {encoding:'utf8',timeout:10000,maxBuffer:16384});
  assert.strictEqual(r.status,1,r.stderr);
  assert.match(r.stderr,/normalized depth at actual gl.clear/);
  console.log('PASS reverted exact producer adapter rejected at first normalized depth');
}
console.log('PASS first/repeated/interleaved/default depth, named targets, stencil cache, masks and no-op checks');
