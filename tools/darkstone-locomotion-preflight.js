#!/usr/bin/env node
'use strict';
// No build or browser here. Adds preservation checks around the unchanged
// fadaff paired controller, borrowing its prior verified build receipts.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT='/home/user/wa-darkstone-paired', OLD='/home/user/darkstone-paired-evidence';
const OUT='/home/user/darkstone-locomotion-evidence';
const MANIFEST='e1c22622ec990a7ec88ff55b7b65d0e8f7199cb88af44b758f4e319d83b682dc';
const DONOR='/home/user/wa-ne-invoke-native', SOURCE='0768448d67a727a64370c55738346ccb2d8eaeae';
const MODULE='d6187fedf42d597311446e527d586b74a06db4f7f5eaaa6b51e483c5cc06603b';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function readPinned(file,digest){const bytes=fs.readFileSync(file);assert.equal(sha(bytes),digest,file);return JSON.parse(bytes);}
function verifyEvidence(manifest){assert.equal(manifest.files.length,166);for(const r of manifest.files)assert.equal(sha(fs.readFileSync(r.path)),r.sha256,r.path);}
function admittedSources(root,records,tree){
 const entries=new Map(tree.split('\0').filter(Boolean).map(row=>{const m=/^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(row);assert(m);return [m[3],{mode:m[1],blob:m[2]}];}));
 const names=new Set();const files=records.map(row=>{
  assert(!path.isAbsolute(row.path)&&!row.path.split('/').includes('..'));assert(!names.has(row.path));names.add(row.path);
  const entry=entries.get(row.path);assert(entry,'admitted file in immutable tree');const p=path.join(root,row.path);
  const bytes=entry.mode==='120000'?Buffer.from(fs.readlinkSync(p)):fs.readFileSync(p);assert.equal(sha(bytes),row.sha256,p);
  assert.equal(crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),entry.blob,p);
  return {...row,path:p};
 });
 return {files,notInAdmittedInventory:[...entries.keys()].filter(p=>!names.has(p))};
}
function snapshotFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?snapshotFiles(p):[{path:p,sha256:sha(e.isSymbolicLink()?Buffer.from(fs.readlinkSync(p)):fs.readFileSync(p)),symlink:e.isSymbolicLink()}];});}
function seedReceipts(manifest,old,out){
 assert(!fs.existsSync(out),'fresh output only');
 const receipts=['preflight.json','build.json'].map(name=>{const source=path.join(old,name),row=manifest.files.find(r=>r.path===source);assert(row,'receipt in admitted archive');const bytes=fs.readFileSync(source);assert.equal(sha(bytes),row.sha256,source);return {name,source,bytes,sha256:row.sha256};});
 fs.mkdirSync(out);
 for(const r of receipts)fs.writeFileSync(path.join(out,r.name),r.bytes,{flag:'wx'});
 return receipts.map(({name,source,sha256})=>({name,source,sha256,provenance:'Borrowed unchanged prior build/preflight receipt; not a fresh build'}));
}
function main(){
 const [phase,configFile,manifestFile]=process.argv.slice(2);assert(['prepare','postflight'].includes(phase));
 const api=require(ROOT+'/tools/darkstone-paired-validation');const env=api.cleanEnvironment();
 const exec=(bin,args,cwd=ROOT)=>cp.execFileSync(bin,args,{cwd,env,encoding:'utf8',timeout:30000,maxBuffer:32*1024**2});
 const c=api.validateConfig(JSON.parse(fs.readFileSync(configFile)));assert.equal(c.root,ROOT);assert.equal(c.out,OUT);assert.equal(c.commit,'fadaff08a3088d242a6e648e2f99c19eaad341fe');
 const manifest=readPinned(manifestFile,MANIFEST);verifyEvidence(manifest);
 for(const [p,digest] of [...api.PRESERVED,[DONOR+'/build/wine-assembly.wasm',MODULE]])assert.equal(sha(fs.readFileSync(p)),digest,p);
 assert.equal(exec('git',['rev-parse','HEAD'],DONOR).trim(),SOURCE);
 const admitted=readPinned('/tmp/wa-ne-invoke-native-20261015/postflight.json','b7fb1a9f32c673de998ca9e9713036224a23955d82f67a374632a7b5ab5d4d25');
 assert.equal(admitted.commit,SOURCE);assert.equal(admitted.records.length,5062);
 const donorSource=admittedSources(DONOR,admitted.records,exec('git',['ls-tree','-r','-z',SOURCE],DONOR));
 const inventory=exec('ps',['-eo','pid,ppid,pgid,stat,comm']);
 const active=inventory.split('\n').filter(l=>{const m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s*$/.exec(l);return m&&+m[1]!==process.pid&&!m[4].startsWith('Z')&&/^(node|MainThread|chrome|chromium|firefox|wat2wasm)$/.test(m[5]);});assert.equal(active.length,0,active.join('\n'));
 let fifa;
 if(phase==='prepare'){
  fifa={source:'e5c7a2f720b32bb9b330df2e3d9a9b2204370e75',evidence:snapshotFiles('/home/user/fifa98-controller-evidence-1'),helper:['web-input-probe.js','capture-legacy-render-evidence.js','fifa98-controller-state.js','fifa98-controller-state-safe.js'].map(name=>{const p='/home/user/fifa98-controller-helper-1/tools/'+name;return {path:p,sha256:sha(fs.readFileSync(p))};})};
 }else{fifa=JSON.parse(fs.readFileSync(OUT+'/locomotion-prepare.json')).fifa;for(const r of [...fifa.evidence,...fifa.helper])assert.equal(sha(r.symlink?Buffer.from(fs.readlinkSync(r.path)):fs.readFileSync(r.path)),r.sha256,r.path);}
 const result={fifa,at:new Date().toISOString(),passed:true,phase,active,inventory,controllerSha256:sha(fs.readFileSync(__filename)),manifestSha256:MANIFEST,preservedEvidenceFiles:manifest.files.length,additionalDonor:{root:DONOR,source:SOURCE,module:MODULE,files:donorSource.files,notInAdmittedInventory:donorSource.notInAdmittedInventory,inventorySha256:'b7fb1a9f32c673de998ca9e9713036224a23955d82f67a374632a7b5ab5d4d25'},buildProvenance:'Reusing normal build from paired evidence; no rebuild in this capture'};
 if(phase==='prepare')result.borrowed=seedReceipts(manifest,OLD,OUT);
 fs.writeFileSync(path.join(OUT,'locomotion-'+phase+'.json'),JSON.stringify(result,null,2),{flag:'wx'});
 console.log(JSON.stringify({at:result.at,passed:true,phase,active,preservedEvidenceFiles:manifest.files.length,buildProvenance:result.buildProvenance}));
}
module.exports={readPinned,verifyEvidence,seedReceipts,admittedSources,MANIFEST};
if(require.main===module)try{main();}catch(e){console.error(e.stack);process.exitCode=1;}
