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
const setup = source.slice(0, source.indexOf(marker));
const challenge = String.raw`
// Set the synthetic equivalent of a custom format *before* acquiring.
// Only DIK_SPACE is requested, at custom byte offset 7. A is omitted.
const property=0x23000, map=0x24000;
e.unacquire(obj);
[20,16,0,0,3].forEach((v,i)=>wr(e.g2w(property)+i*4,v));
e.setBufferSize(obj,property);assert.equal(rd(e.reg()),0);
for(let i=0;i<256;i++)wr(e.g2w(map)+i*4,0xffffffff);
wr(e.g2w(map)+57*4,7);wr(e.state(),map);
function acquire(){e.acquire(obj);assert.equal(rd(e.reg()),0);}
function tap(vk){renderer.handleKeyDown(vk);renderer.handleKeyUp(vk);}
function dispatch(){while(renderer.checkInput()){};publishBoundary();}
function oracle(result){
 assert.equal(result.hr,0,'omitted objects must not cause buffer overflow');
 assert.equal(result.count,2,'two requested edges fit effective capacity two');
 assert.deepEqual(result.records.map(x=>x.slice(0,2)),[[7,128],[7,0]],
  'custom format retains ordered Space edges at offset 7');
}
acquire();tap(32);dispatch();const positive=poll();oracle(positive);
// The same oracle must reject distinct loss/order/false-overflow defects.
const controls=[
 ['lost requested edge',{...positive,count:1,records:positive.records.slice(0,1)}],
 ['reversed requested edges',{...positive,records:[...positive.records].reverse()}],
 ['spurious overflow',{...positive,hr:1}],
];
for(const [name,result] of controls){assert.throws(()=>oracle(result),assert.AssertionError);}
console.log(JSON.stringify({group:'independent oracle controls',pass:true,
 positive, rejected:controls.map(x=>x[0])}));
e.unacquire(obj);acquire();
tap(65);tap(32);dispatch();
const observed=poll();
console.log(JSON.stringify({group:'omitted-key saturation',candidate:'24212b72fdedf2ff0274b156ed1503c76edc5b96',
 input:['A down','A up','Space down','Space up'],configuredSize:3,effectiveCapacity:2,
 customFormat:{57:7,others:'omitted'},observed,
 expected:{hr:0,count:2,pairs:[[7,128],[7,0]]},noGameplayClaim:true}));
oracle(observed); // First contract failure stops acceptance.
e.unacquire(obj);
`;
console.log(JSON.stringify({fixtureSHA256:sha(source),setupSHA256:sha(setup),
 challengeSHA256:sha(challenge),transformation:'exact fixture prefix before const events=[]; + independent challenge',
 productionSources:'unchanged; fixture compiles original WAT forms, unrelated dependencies trap'}));
const child = new Module(fixture, module);
child.filename = fixture;
child.paths = Module._nodeModulePaths(__dirname);
child._compile(setup + challenge, fixture);
