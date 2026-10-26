'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs'), Module = require('node:module'), path = require('node:path');
const {instrument} = require('../tools/d3d9-operation-observer');
const host = require.resolve('../lib/d3d9-host'), helper = require.resolve('../tools/d3d9-rgba-benchmark');
function read(filename) {
  const fd = fs.openSync(filename,'r'), chunk = Buffer.alloc(65536), parts = [];
  try {
    let n, total = 0;
    while ((n = fs.readSync(fd,chunk,0,chunk.length,null))) {
      total += n; assert(total <= 2097152); parts.push(Buffer.from(chunk.subarray(0,n)));
    }
    return Buffer.concat(parts).toString();
  } finally { fs.closeSync(fd); }
}
const original = read(host), helperSource = read(helper);
const anchor = 'const src=new Uint8Array(memory,g2w(bits),byteLength);';
function load(code, prefix = '') {
  const saved = [host,helper].map(p => [p,require.cache[p]]);
  function compile(filename, source) {
    const m = new Module(filename,module);
    m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
    require.cache[filename] = m; m._compile(source,filename); m.loaded = true; return m.exports;
  }
  try {
    assert.equal(original.split(anchor).length,2);
    compile(host,prefix+original.replace(anchor,anchor+code)); return compile(helper,helperSource);
  } finally { for (const [p,m] of saved) { if (m) require.cache[p] = m; else delete require.cache[p]; } }
}

const ranges = [
  {name:'nested subarray and ordinary alias', view:'src.subarray(7,-5).subarray(9,-11)', bytes:n=>n-32},
  {name:'captured constructor at interior offset', view:'new Captured(src.buffer,src.byteOffset+3,src.length-6)', bytes:n=>n-6},
  {name:'surrounding view counts only source intersection', view:'new Captured(src.buffer,src.byteOffset-4,src.length+8)', bytes:n=>n},
  {name:'view straddling source start', view:'new Captured(src.buffer,src.byteOffset-5,13)', bytes:()=>8},
  {name:'view straddling source end', view:'new Captured(src.buffer,src.byteOffset+src.length-7,13)', bytes:()=>7},
  {name:'disjoint view in same backing store', view:'new Captured(src.buffer,512,17)', bytes:()=>0},
  {name:'empty nested view', view:'src.subarray(5,5).subarray()', bytes:()=>0},
];
for (const p of ranges) test(`indexed accounting: ${p.name}`,async()=>{
  const code = `const view=${p.view},alias=view;let sum=0;for(let j=0;j<alias.length;j++)sum+=alias[j];
    this.rangeProbe={sum,offset:view.byteOffset,length:view.length};`;
  const h = load(code,'const Captured=Uint8Array;\n'), f = h.fixture(16);
  try {
    assert.equal(f.draw(),1); await f.drain();
    const c = h.measure(f); await f.drain();
    const {sum,offset,length} = f.bridge.rangeProbe;
    assert.equal(sum,new Uint8Array(f.source().buffer,offset,length).reduce((a,b)=>a+b,0));
    assert.equal(c.indexedSourceReads,p.bytes(f.bytes));
    assert.deepEqual(f.seen.at(-1).pixels,f.expected());
    if (p.bytes(f.bytes)) assert.throws(()=>h.budget(c,f.bytes,f.bytes,true),/indexed source read/);
    else h.budget(c,f.bytes,f.bytes,true);
  } finally { await f.close(); }
});

test('source key coercion, valid bounds and outside-range indices are counted exactly',async()=>{
  const h = load(`let conversions=0;const view=new Uint8Array(src.buffer,src.byteOffset-4,src.length+8);
    const key={ [Symbol.toPrimitive](hint){if(hint!=='string')throw Error('key hint');conversions++;return '4';} };
    this.rangeProbe=[view[key],view[0],view[view.length-1],src[src.length],src['00'],src[-1],conversions];`);
  const f = h.fixture(16);
  try {
    assert.equal(f.draw(),1); await f.drain(); const c = h.measure(f); await f.drain();
    assert.deepEqual(f.bridge.rangeProbe,[f.source()[0],0,0,undefined,undefined,undefined,1]);
    assert.equal(c.indexedSourceReads,1);
    assert.throws(()=>h.budget(c,f.bytes,f.bytes,true),/indexed source read/);
  } finally { await f.close(); }
});

test('constructor copies through nested source aliases count the copied range',async()=>{
  const h = load('this.rangeProbe=new Captured(src.subarray(3,-4).subarray(5,-6));','const Captured=Uint8Array;\n');
  const f = h.fixture(16);
  try {
    assert.equal(f.draw(),1); await f.drain(); const c = h.measure(f); await f.drain();
    assert.deepEqual(f.bridge.rangeProbe,f.source().subarray(8,-10));
    assert.equal(c.sourceCopyBytes,f.bytes-18); assert.equal(c.constructorCopyBytes,f.bytes-18);
    assert.throws(()=>h.budget(c,f.bytes,f.bytes,true),/private source copy/);
  } finally { await f.close(); }
});

for (const p of [
  {name:'outside', start:2, end:6, copied:0},
  {name:'left overlap', start:4, end:12, copied:4},
  {name:'right overlap with negative offset', start:-12, end:-4, copied:4},
]) test(`slice source intersection: ${p.name}; native coercion order`,async()=>{
  const h = load(`const log=[],v=new Uint8Array(src.buffer,src.byteOffset-8,src.length+16);
    this.rangeProbe={pixels:v.slice({valueOf(){log.push('start');return ${p.start};}},
      {valueOf(){log.push('end');return ${p.end};}}),log};`);
  const f = h.fixture(16);
  try {
    assert.equal(f.draw(),1); await f.drain(); const c = h.measure(f); await f.drain();
    const v = new Uint8Array(f.source().buffer,f.bits[0]-8,f.bytes+16);
    assert.deepEqual(f.bridge.rangeProbe,{pixels:v.slice(p.start,p.end),log:['start','end']});
    assert.equal(c.sourceCopyBytes,p.copied); assert.equal(c.sliceBytes,5632+f.bridge.rangeProbe.pixels.length);
    if (p.copied) assert.throws(()=>h.budget(c,f.bytes,f.bytes,true),/private source copy/);
    else h.budget(c,f.bytes,f.bytes,true);
  } finally { await f.close(); }
});

function execute(source) {
  const m = {exports:{}};
  const observer = {read:(o,k)=>o[k],readOptional:(o,k)=>o==null?undefined:o[k()],construct:(t,a)=>Reflect.construct(t,a)};
  Function('module','__renderOperationObserver',source)(m,observer); return m.exports;
}
test('computed template tag preserves receiver, getter/key/substitution order and template object identity',()=>{
  const source = "'use strict';const log=[],templates=[];let expected;const obj={value:17,get tag(){log.push('get');return function(t,v){log.push(this===expected,this.value,v);templates.push(t);return this.value+v;};}};expected=obj;const object=()=>{log.push('object');return obj;};const key={ [Symbol.toPrimitive](hint){log.push(hint);return 'tag';} };const sub=()=>{log.push('sub');return 5;};let result;for(let i=0;i<2;i++)result=(object()[key])`a${sub()}b`;module.exports={log,result,same:templates[0]===templates[1],frozen:Object.isFrozen(templates[0])&&Object.isFrozen(templates[0].raw),raw:templates[0].raw};";
  const plain = execute(source); assert.equal(plain.result,22); assert(plain.same && plain.frozen);
  assert.deepEqual(execute(instrument(source)),plain);
});
for (const stage of ['object','key','get','sub','tag']) test(`computed template tag preserves ${stage} throw and preceding side effects`,()=>{
  const source = `'use strict';const log=[];function step(s){log.push(s);if(s==='${stage}')throw Error(s);}
    const obj={get tag(){step('get');return function(){step('tag');return this===obj;};}};
    function object(){step('object');return obj;}const key={toString(){step('key');return 'tag';}};
    function sub(){step('sub');return 1;}let error;try{object()[key]\`x\${sub()}\`;}catch(e){error=e.message;}
    module.exports={log,error};`;
  const plain = execute(source); assert.equal(plain.error,stage);
  assert.deepEqual(execute(instrument(source)),plain);
});
test('nested tags, sequence tags and super tag references retain native receivers',()=>{
  const source = "'use strict';const log=[];const obj={tag(){log.push(this===obj);return function(){log.push(this===undefined);};}};obj['tag']`a``b`;const bare={tag(){log.push(this===undefined);}};(0,bare['tag'])`c`;class A{tag(){log.push(this instanceof B);}}class B extends A{run(){super['tag']`d`;}}new B().run();module.exports=log;";
  const plain = execute(source); assert.deepEqual(plain,[true,true,true,true]);
  assert.deepEqual(execute(instrument(source)),plain);
});
test('actual producer tag throw restores descriptors, snapshot source and observer scope',async()=>{
  const h = load("if(this.tagFault){const log=[];this.tagLog=log;const receiver={get tag(){log.push('get');return function(t,v){log.push(this===receiver,v);throw Error('tag sentinel');};}};const key=()=>{log.push('key');return 'tag';};receiver[key()]`a${(log.push('sub'),3)}`;}");
  const f = h.fixture(16), Native = Uint8Array;
  const global = Object.getOwnPropertyDescriptor(globalThis,'Uint8Array');
  const hooks = Object.fromEntries(['every','slice','set'].map(k=>[k,Object.getOwnPropertyDescriptor(Native.prototype,k)]));
  try {
    assert.equal(f.draw(),1); await f.drain();
    const snap = f.bridge._textureSnapshots.get(f.records[0]+64), source = snap.source;
    f.bridge.tagFault = true;
    assert.throws(()=>h.measure(f),/tag sentinel/);
    assert.deepEqual(f.bridge.tagLog,['key','get','sub',true,3]);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'Uint8Array'),global);
    for (const [k,d] of Object.entries(hooks)) assert.deepEqual(Object.getOwnPropertyDescriptor(Native.prototype,k),d);
    assert.equal(snap.source,source);
    assert(!Object.hasOwn(f.bridge,'_residentLevel')); assert(!Object.hasOwn(f.bridge,'_rememberTexture'));
    f.bridge.tagFault = false;
    // The renderer clears its vertex scratch on a failed draw. Observe the
    // real recovery allocation rather than hiding it to make a warm budget pass.
    const recovery = h.measure(f); await f.drain();
    assert.equal(recovery.backingAllocationBytes,4096);
    assert.throws(()=>h.budget(recovery,f.bytes,f.bytes,true),/backing allocation/);
    h.budget(h.measure(f),f.bytes,f.bytes,true); await f.drain();
    assert.deepEqual(f.seen.at(-1).pixels,f.expected());
  } finally { await f.close(); }
});
test('unsupported optional references, suspended keys and computed super reads fail explicitly',()=>{
  for (const source of [
    'obj?.method[key]();', 'obj?.[key]();', '(obj?.[key])();', '(obj?.[key])`tag`;',
    'delete obj?.[key];', 'async function f(){return obj?.[await key()];}',
    'function* f(){return obj?.[yield 1];}', 'obj?.[eval("key")];',
    'class A extends B { f(){return super[key];} }',
  ]) assert.throws(()=>instrument(source),/outside the observer grammar/,source);
});
