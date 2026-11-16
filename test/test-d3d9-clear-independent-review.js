'use strict';
// Bounded review reproducer: no constructor, driver, browser, Wasm or guest.
const assert = require('assert');
const cp = require('child_process');
const Module = require('module');
const path = require('path');
const Clear = require('../lib/render-clear');
const {WebGLBackend} = require('../lib/gpu-backend');
let {Device} = require('../lib/d3d9-backend');
if (process.argv.includes('--baseline')) {
  const filename = path.resolve(__dirname, '../lib/d3d9-backend.js');
  const m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths;
  // That historical backend requires its retained JS fixed compiler, which
  // slice 9.2 deleted from the tree: load it from the same revision.
  m.require = id => {
    if (id !== './d3d9-fixed') return Module.prototype.require.call(m, id);
    const fixedName = path.resolve(__dirname, '../lib/d3d9-fixed.js'), f = new Module(fixedName, m);
    f.filename = fixedName; f.paths = module.paths;
    f._compile(cp.execFileSync('git', ['show', 'f6571101e38985b3fa34d328f2ccadd9735a7573:lib/d3d9-fixed.js'],
      {stdio:['ignore','pipe','ignore'], maxBuffer:1 << 20}).toString(), fixedName);
    return f.exports;
  };
  m._compile(cp.execFileSync('git', ['show',
    'f6571101e38985b3fa34d328f2ccadd9735a7573:lib/d3d9-backend.js'],
    {stdio:['ignore','pipe','ignore'], maxBuffer:131072}).toString(), filename);
  Device = m.exports.Device;
}
function observation() {
  const g = Object.create(WebGLBackend.prototype);
  const writes = [], clears = [];
  let driverDepth = 1;
  g.canvas = {width:4,height:4};
  g._stateValues = new Map();
  g.gl = {SCISSOR_TEST:1, COLOR_BUFFER_BIT:2, DEPTH_BUFFER_BIT:4, STENCIL_BUFFER_BIT:8,
    clearDepth(z) {driverDepth=z; writes.push(z);},
    clear(mask) {clears.push({mask,depth:driverDepth});},
    clearColor() {}, colorMask() {}, depthMask() {}, enable() {}, disable() {}, scissor() {}};
  // Target allocation is outside this reproducer; the clear and state cache
  // below are unmodified production WebGLBackend methods.
  g.bindRenderTarget = () => {};
  const d = Object.create(Device.prototype);
  d.gpu = g; d.colorTargets = new Map(); d.depthTargets = new Map();
  for (const z of [.25,.5]) {
    if (process.argv.includes('--baseline')) d.clear([0,0,0,0],2,z);
    else d.clearCommand(structuredClone(Clear.create({color:[0,0,0,0],flags:2,depth:z},4,4)));
  }
  return {writes,clears};
}
if (process.argv.includes('--probe')) {
  const actual = observation();
  console.log(JSON.stringify(actual));
  assert.deepStrictEqual(actual.clears,[{mask:4,depth:.25},{mask:4,depth:.5}],
    'actual production GPU wrapper must preserve each normalized clear depth');
} else {
  const p = Clear.create({color:[1,0,0,1],flags:1,rects:[[-2,1,8,5]],clip:[1,0,3,3]},4,4);
  assert.deepStrictEqual(p.rects,[[1,1,3,3]]);
  assert(Object.isFrozen(p.rects[0]));
  const clone = structuredClone(p);
  assert.strictEqual(Clear.validate(clone,4,4).depthAttachment,undefined);
  for (const patch of [{width:3},{origin:'bottom-left'},{rects:[[-1,0,2,2]]},
    {colorAttachment:{id:0,width:4,height:4,format:21}},
    {depthAttachment:{id:9,width:3,height:4,format:75}},{flags:8}])
    assert.throws(()=>Clear.validate({...clone,...patch},4,4));
  assert.throws(()=>Clear.command({color:[1,0,0,1],flags:1,rects:[[-1,0,2,2]]},4,4));
  assert.deepStrictEqual(Clear.command({color:[1,0,0,1],flags:0,rects:[[1,1,1,2]]},4,4).rects,[]);
  assert.throws(()=>Clear.create({color:[0,0,0,0],flags:2,depthAttachment:null},4,4));
  for (const baseline of [false,true]) {
    const args = ['--max-old-space-size=256',__filename,'--probe',...(baseline?['--baseline']:[])];
    const r = cp.spawnSync(process.execPath,args,{encoding:'utf8',timeout:10000,maxBuffer:16384});
    assert.strictEqual(r.status,baseline?1:0,r.stderr);
    if(baseline)assert.match(r.stderr,/actual production GPU wrapper must preserve/);
    const observed = JSON.parse(r.stdout.trim());
    assert.deepStrictEqual(observed,baseline?
      {writes:[.25,1,.5],clears:[{mask:4,depth:1},{mask:4,depth:.5}]}:
      {writes:[.25,.5],clears:[{mask:4,depth:.25},{mask:4,depth:.5}]});
    console.log(JSON.stringify({revision:baseline?'base f6571101':'repaired candidate',expectedRejection:baseline,...observed}));
  }
  console.log('PASS independent clipping/clone/validation checks; repaired candidate PASS and exact baseline REJECTED');
}
