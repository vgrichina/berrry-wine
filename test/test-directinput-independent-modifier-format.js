'use strict';
// Independent acceptance of candidate 24212b72. Production source stays unchanged.
// Reuse the pinned focused compiler/host setup, never its passing test groups.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Module = require('module');
const fixture = path.join(__dirname, 'test-directinput-buffered-keyboard.js');
const source = fs.readFileSync(fixture, 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
if (sha(source) !== 'ea5c710903a5ef181df4c516b36bd3a66d919ad5127c8e667b91927853a3b98a')
  throw Error('production fixture identity changed');
const marker = 'const events=[];';
if (source.split(marker).length !== 2) throw Error('ambiguous setup boundary');
let setup = source.slice(0, source.indexOf(marker));
const additions=['$handle_IDirectInputDevice_SetDataFormat','$di_standard_data_format_size','$di_custom_data_format',
 '$di_format_map_drop','$di_format_map_install','$di_format_map_set','$di_object_type','$di_object_exists',
 '$di_object_guid_matches','$di_object_guid_data1','$heap_alloc','$heap_free'];
setup=setup.replace('const picked=new Map(),stubs=new Map();',
 `for(const name of ${JSON.stringify(additions)})funcs.add(name);
 // Allocation is fixture-owned; all DirectInput production forms are byte-exact.
 byName.set('$heap_alloc','(func $heap_alloc (param $size i32) (result i32) (i32.const 0x28000))');
 byName.set('$heap_free','(func $heap_free (param i32))');
 const picked=new Map(),stubs=new Map();`);
setup=setup.replace('const extra=`','const extra=`(func (export "setFormat") (param i32 i32) (call $handle_IDirectInputDevice_SetDataFormat (local.get 0) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))');

const challenge = String.raw`
const property=0x23000,format=0x24000,objects=0x25000;
function dispatch(){while(renderer.checkInput()){};publishBoundary();}
function setFormat(dik){
 e.unacquire(obj);
 [20,16,0,0,3].forEach((v,i)=>wr(e.g2w(property)+i*4,v));
 e.setBufferSize(obj,property);assert.equal(rd(e.reg()),0);
 [24,16,2,8,1,objects].forEach((v,i)=>wr(e.g2w(format)+i*4,v));
 [0,7,(dik<<8)|12,0].forEach((v,i)=>wr(e.g2w(objects)+i*4,v));
 e.setFormat(obj,format);assert.equal(rd(e.reg()),0,'production SetDataFormat accepts requested object');
 const installed=rd(e.state());assert(installed);assert.equal(rd(e.g2w(installed)+dik*4),7);
 e.acquire(obj);assert.equal(rd(e.reg()),0);
 return installed;
}
function expectEdges(result){assert.equal(result.hr,0);assert.equal(result.count,2);assert.deepEqual(result.records.map(x=>x.slice(0,2)),[[7,128],[7,0]]);}
const requested=process.argv.includes('--right-only')?0x36:0x2a;
const installed=setFormat(requested);
// Mutating caller-owned DIDATAFORMAT after successful SetDataFormat must not
// mutate its installed map or acquisition filter. Keep the input physically right.
wr(e.g2w(objects)+8,(57<<8)|12);wr(e.g2w(objects)+4,1);
assert.equal(rd(e.g2w(installed)+requested*4),7);
renderer.handleKeyDown(16,{code:'ShiftRight',location:2});
renderer.handleKeyUp(16,{code:'ShiftRight',location:2});dispatch();
const observed=poll();
console.log(JSON.stringify({group:'accepted modifier-only custom format',requestedDIK:requested,
 formatAccepted:true,installedMapOffset:rd(e.g2w(installed)+requested*4),
 callerFormatMutated:true,input:['VK_SHIFT right down','VK_SHIFT right up'],
 observed,expected:{hr:0,count:2,pairs:[[7,128],[7,0]]},
 allocationFixture:'bounded private bump allocator and no-op free; production format validation/matching/install, acquire, renderer, host, collect unchanged'}));
expectEdges(observed);
e.unacquire(obj);
`;
console.log(JSON.stringify({fixtureSHA256:sha(source),setupSHA256:sha(setup),
 challengeSHA256:sha(challenge),transformation:'pinned fixture prefix + explicit SetDataFormat closure and fixture allocator + independent modifier challenge',
 productionSources:'unchanged; fixture compiles original WAT forms, unrelated dependencies trap'}));
const child = new Module(fixture, module);
child.filename = fixture;
child.paths = Module._nodeModulePaths(__dirname);
child._compile(setup + challenge, fixture);
