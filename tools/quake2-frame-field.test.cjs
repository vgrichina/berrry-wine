'use strict';
// Offline decoder controls plus replay through the unchanged real page reader.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const zlib=require('node:zlib'),cp=require('node:child_process');
const decoder=require('./quake2-frame-field.cjs'),core=require('../lib/quake2-owning-load-core');
const {readPE}=require('../lib/pe');
const output=process.env.Q2_FRAME_FIELD_TEST_OUTPUT;
assert(output,'fresh Q2_FRAME_FIELD_TEST_OUTPUT required');fs.mkdirSync(output,{recursive:false});
const receipt=process.env.Q2_FRAME_FIELD_RECEIPT;
assert(receipt,'Q2_FRAME_FIELD_RECEIPT required: retained 1265 retrieval-verified.json.gz');
const report=decoder.fromReceipt(receipt),r=report.firstReject;
assert.equal(report.history.sha256,'d142b399321787256cc41a497ea3d049a42f71129dedaf63b0af3a2f17a6872c','exact1265 stored history');
assert.equal(report.history.original.sha256,'9a45cda91fd24966389c3a9c06ac04ec2e0269381fb49b59e84ee63804741433');
assert.equal(report.rows,1463);assert.equal(report.terminalIndex,1462);
assert.equal(report.terminalReason,'passive health/motion UNKNOWN');
assert.deepEqual(r.currentDifferences,[{offset:232,first:5,second:9,field:'num_entities'}]);
assert.equal(r.executedMotionEqual,false);assert.equal(r.executedPublicationCheck,'NOT_EXECUTED');
assert.deepEqual(r.publishedDifferences,[]);assert.deepEqual(r.damageDifferences,[]);
for(const [key,count] of [['motionFirst',5],['motionSecond',9]]){
 assert.equal(r.motion[key].current.numEntities,count);
 assert.equal(r.motion[key].current.frameNumber,586);assert.equal(r.motion[key].current.serverTimeMs,58600);
 assert.equal(r.motion[key].current.signedHP,100);assert.equal(r.motion[key].published.frameNumber,570);
 assert.equal(r.motion[key].slot,0xa9d8ec);
}
assert.match(r.nativeCause,/UNKNOWN/);assert.match(r.repair,/NONE/);
// Verify actual store/increment/call/copy bytes, rather than using authored
// writer code to claim that an original instruction executed in run1265.
const pe=readPE(core.EXE),b=fs.readFileSync(core.EXE);
for(const [va,hex] of [[0x402a8d,'8bb0e8000000'],[0x402a9e,'4689b0e8000000'],
 [0x402bed,'8998e8000000'],[0x4034fe,'e8cdf6ffff'],[0x403527,'f3a5'],[0x409221,'f3ab']]){
 const want=Buffer.from(hex,'hex');assert.deepEqual(b.subarray(pe.va2off(va),pe.va2off(va)+want.length),want);
}
const packed=fs.readFileSync(report.history.path),rows=zlib.gunzipSync(packed).toString().trim().split('\n').map(JSON.parse);
const rejected=rows[report.terminalIndex].attackInput.rejectedFrame;
const {fixture}=require('./quake2-passive-attack.test.cjs');
const f=fixture(),offset=va=>va-0x400000+0x12000;
function install(motion,damage){
 f.put(0xa86a60,motion.state);
 new Uint8Array(f.memory.buffer,offset(0xa9cf8c),3840).set(damage);
 new Uint8Array(f.memory.buffer,offset(0xa9ce98),240).set(motion.current);
 new Uint8Array(f.memory.buffer,offset(motion.slot),240).set(motion.published);
}
install(rejected.motionFirst,rejected.damageFirst);
let swapped=false;
f.renderer.peekKeyDownState=()=>{
 if(!swapped){swapped=true;install(rejected.motionSecond,rejected.damageSecond);}return 0;
};
const actual=JSON.parse(JSON.stringify(f.read()));
assert.equal(actual.playerMotion.status,'UNKNOWN');assert.equal(actual.damageFeedback.status,'UNKNOWN');
assert.equal(actual.rejectedFrame.predicates.motionEqual,false);
assert(!('motionPublishedMatches' in actual.rejectedFrame.predicates));
const replay=decoder.decodeRejection({at:'authored replay of retained bytes',attackInput:actual});
assert.deepEqual(replay.currentDifferences,r.currentDifferences);
assert.deepEqual(replay.motion,r.motion);
// Signed HP and terminal ordering controls operate on complete decoded rows.
const healthy=h=>({attackInput:{status:'SNAPSHOT',playerMotion:{status:'SNAPSHOT'},
 damageFeedback:{status:'SNAPSHOT',current:{health:h},observedHealthDecreases:[]}}});
for(const hp of [98,0,-1]){
 const terminal=decoder.firstTerminal([healthy(100),healthy(hp),rows.at(-1)]);
 assert.equal(terminal.index,1);assert.equal(terminal.reason,'first passive HP loss/death');
}
assert.equal(decoder.firstTerminal([healthy(-1),healthy(100),rows.at(-1)]).index,2,'negative HP cannot arm');
assert.equal(decoder.firstTerminal([healthy(100),rows.at(-1),healthy(98)]).index,1,'UNKNOWN cannot be skipped');
const signed=[...rejected.motionFirst.current];signed[0xaa]=255;signed[0xab]=255;
assert.equal(decoder.decodeFrame(signed).signedHP,-1);
assert.throws(()=>decoder.decodeFrame(signed.slice(1)),/complete/);
signed[0]=256;assert.throws(()=>decoder.decodeFrame(signed),/complete/);
const missing=structuredClone(rows.at(-1));missing.attackInput.rejectedFrame.damageSecond=null;
assert.throws(()=>decoder.decodeRejection(missing),/complete second/);
// Small synthetic receipt tests identity/CRC refusal without copying history.
const tiny=zlib.gzipSync(Buffer.from('control')),stored=path.resolve(output,'tiny.gz');fs.writeFileSync(stored,tiny);
function badReceipt(entry){const p=path.resolve(output,'bad-receipt.json');fs.writeFileSync(p,JSON.stringify({passed:true,files:[{remote:'original/passive-health-history.jsonl.gz',...entry}]}));return p;}
const entry={stored:'tiny.gz',size:tiny.length,sha256:core.hash(tiny),original:{size:7,sha256:core.hash(Buffer.from('control'))}};
assert.throws(()=>decoder.fromReceipt(badReceipt({...entry,size:tiny.length+1})),/stored size/);
assert.throws(()=>decoder.fromReceipt(badReceipt({...entry,sha256:'0'.repeat(64)})),/stored SHA/);
const broken=Buffer.from(tiny);broken[broken.length-8]^=1;fs.writeFileSync(stored,broken);
assert.throws(()=>decoder.fromReceipt(badReceipt({...entry,sha256:core.hash(broken)})),/check|length|data/i);
assert.throws(()=>decoder.fromReceipt(badReceipt({...entry,stored:'../outside.gz'})),/inside receipt/);
const destination=path.resolve(output,'cli.json');
cp.execFileSync(process.execPath,[path.resolve(__dirname,'quake2-frame-field.cjs'),receipt,destination]);
assert.deepEqual(JSON.parse(fs.readFileSync(destination)),report);
const overwrite=cp.spawnSync(process.execPath,[path.resolve(__dirname,'quake2-frame-field.cjs'),receipt,destination]);
assert.notEqual(overwrite.status,0);assert.match(overwrite.stderr.toString(),/EEXIST/);
fs.writeFileSync(path.resolve(output,'result.json'),JSON.stringify({passed:true,exact1265:true,
 actualSerializedReaderReplay:'UNKNOWN motionEqual false; not native writer execution',
 binaryInstructionChecks:true,identityCRCRefusals:true,firstHealthLossDeathUnknownPreserved:true,
 productionReaderChanged:false,nativeCause:'UNKNOWN'},null,2)+'\n');
console.log('PASS exact1265 field mapping, pinned binary stores/calls/copy, real serialized reader replay, signed HP/first-terminal order, size/SHA/CRC/missing snapshot refusals, exclusive CLI output; no native repair claimed');
