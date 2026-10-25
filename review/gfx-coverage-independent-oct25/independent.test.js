'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {verify}=require(process.env.GFX_VERIFIER || '../../repo/tools/gfx-runtime-coverage.js');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'independent-gfx-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const manifest={version:1,apps:[{app:'scene-app',build:'sha256:immutable-build'}]};
 const evidence={version:1,records:['software','webgl'].map(backend=>{
  const bytes=Buffer.from(`separate run ${backend}: frame=120 scene=menu\n`),p=backend+'.log';fs.writeFileSync(path.join(root,p),bytes);
  return {app:'scene-app',backend,build:manifest.apps[0].build,kind:'runtime',run:'run-'+backend,observation:'Fixture models separate same-scene capture; not corpus evidence.',artifact:{path:p,sha256:sha(bytes)}};
 })};return {root,manifest,evidence,check:()=>verify(manifest,evidence,root)};
}
test('separate backend runs observing the same scene with distinct logs pass',t=>assert.equal(fixture(t).check().complete,true));
for(const field of ['app','backend','build']){
 for(const [label,value] of [['null',null],['number',7],['array',[]],['object',{}],['empty',''],['whitespace',' '],['wrong','unlisted']])test(`${field}: rejects ${label}`,t=>{const f=fixture(t);f.evidence.records[0][field]=value;assert.equal(f.check().complete,false);});
 test(`${field}: rejects missing`,t=>{const f=fixture(t);delete f.evidence.records[0][field];assert.equal(f.check().complete,false);});
}
for(const [name,mutate] of [
 ['extra identity field',f=>f.evidence.records[0].appId='scene-app'],
 ['extra artifact field',f=>f.evidence.records[0].artifact.backend='software'],
 ['false completion metadata',f=>{f.evidence.records=[];f.evidence.complete=true;}],
 ['missing webgl despite complete claim',f=>{f.evidence.records.pop();f.evidence.records[0].complete=true;}],
 ['altered bytes with original digest',f=>fs.appendFileSync(path.join(f.root,'software.log'),'ALTERED')],
 ['missing file',f=>fs.unlinkSync(path.join(f.root,'webgl.log'))],
 ['duplicate valid identity plus malformed competitor',f=>f.evidence.records.push({...structuredClone(f.evidence.records[0]),build:null})],
 ['unknown additional app prevents completion',f=>f.evidence.records.push({...structuredClone(f.evidence.records[0]),app:'unknown'})],
 ['unknown additional backend prevents completion',f=>f.evidence.records.push({...structuredClone(f.evidence.records[0]),backend:'unknown'})],
 ['shared run identity',f=>f.evidence.records[1].run=f.evidence.records[0].run],
 ['one path claimed by both runs',f=>f.evidence.records[1].artifact=structuredClone(f.evidence.records[0].artifact)]
])test(name,t=>{const f=fixture(t);mutate(f);let result;try{result=f.check();}catch{ return; }assert.equal(result.complete,false);});
for(const [name,mutate] of [
 ['manifest missing build',f=>delete f.manifest.apps[0].build],
 ['manifest extra backend identity',f=>f.manifest.apps[0].backend='software'],
 ['manifest malformed app',f=>f.manifest.apps[0].app={}],
 ['evidence extra field',f=>f.evidence.completed=true]
])test(name,t=>{const f=fixture(t);mutate(f);assert.throws(f.check);});
test('LEGITIMATE separate same-scene PNG captures must pass even when pixel and file bytes match',t=>{
 const f=fixture(t);
 // Fixed PNG fixture: two independent deterministic encoders may emit these identical bytes
 // for the same framebuffer. No backend/run metadata is required inside a PNG artifact.
 // A deterministic 320x200 software/WebGL menu framebuffer, encoded as RGB PNG.
 const zlib=require('node:zlib');
 function crc32(b){let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
 function chunk(type,data){const b=Buffer.concat([Buffer.from(type),data]),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(b));return Buffer.concat([n,b,crc]);}
 const width=320,height=200,raw=Buffer.alloc(height*(1+width*3));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const menu=x>=80&&x<240&&[70,100,130].some(top=>y>=top&&y<top+15);
  const title=x>=55&&x<265&&y>=20&&y<40;
  const i=y*(1+width*3)+1+x*3;
  raw[i]=title?220:menu?100:12;raw[i+1]=title?180:menu?110:24;raw[i+2]=title?40:menu?120:40;
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
 for(const r of f.evidence.records){r.artifact={path:r.backend+'-frame120.png',sha256:sha(png)};fs.writeFileSync(path.join(f.root,r.artifact.path),png);}
 const result=f.check();
 if(process.env.GFX_REPRO_DIR){fs.mkdirSync(process.env.GFX_REPRO_DIR,{recursive:true});for(const r of f.evidence.records)fs.copyFileSync(path.join(f.root,r.artifact.path),path.join(process.env.GFX_REPRO_DIR,r.artifact.path));for(const [n,v]of Object.entries({manifest:f.manifest,evidence:f.evidence,actual:result}))fs.writeFileSync(path.join(process.env.GFX_REPRO_DIR,n+'.json'),JSON.stringify(v,null,2)+'\n');}
 assert.equal(result.complete,true,JSON.stringify(result));
});
