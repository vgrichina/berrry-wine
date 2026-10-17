#!/usr/bin/env node
'use strict';
// Read/hash only; writes a fresh JSON receipt. No process launch or guest access.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function row(file) {
 const stat=fs.lstatSync(file); assert(stat.isFile()||stat.isSymbolicLink(),'only files/symlinks');
 const symlink=stat.isSymbolicLink();
 return {path:file,symlink,sha256:sha(symlink?Buffer.from(fs.readlinkSync(file)):fs.readFileSync(file))};
}
function verifyRows(rows) {
 assert(Array.isArray(rows)&&rows.length<=30000,'bounded manifest');
 for(const expected of rows) {
  assert(path.isAbsolute(expected.path),'absolute manifest path');
  assert(/^[a-f0-9]{64}$/.test(expected.sha256),'sha256 required');
  const actual=row(expected.path);assert.equal(actual.sha256,expected.sha256,expected.path);
  if(expected.symlink!==undefined)assert.equal(actual.symlink,expected.symlink,expected.path);
 }
 return rows.length;
}
function capture(config) {
 const rows=new Map(),manifests=[];
 const add=r=>{const old=rows.get(r.path);if(old)assert.equal(old.sha256,r.sha256,'conflicting pin '+r.path);rows.set(r.path,r);assert(rows.size<=30000,'bounded snapshot');};
 for(const m of config.manifests||[]) {
  const bytes=fs.readFileSync(m.path);assert.equal(sha(bytes),m.sha256,m.path);
  const doc=JSON.parse(bytes),selected=m.keys?m.keys.flatMap(k=>{assert(Array.isArray(doc[k]),k);return doc[k];}):doc;
  verifyRows(selected);for(const r of selected)add(row(r.path));manifests.push(row(m.path));
 }
 verifyRows(config.pins||[]);for(const r of config.pins||[])add(row(r.path));
 function walk(dir,depth=0) {
  assert(depth<20,'bounded directory depth');assert(fs.lstatSync(dir).isDirectory(),'snapshot root is directory');
  for(const e of fs.readdirSync(dir,{withFileTypes:true})) {
   const file=path.join(dir,e.name);if(e.isDirectory())walk(file,depth+1);else add(row(file));
  }
 }
 for(const dir of config.roots||[]){assert(path.isAbsolute(dir),'absolute snapshot root');walk(dir);}
 for(const m of manifests)add(m);
 return {at:new Date().toISOString(),rows:[...rows.values()].sort((a,b)=>a.path.localeCompare(b.path)),manifests,
  note:'Read-only external preservation; no guest, idle, fixture or runtime qualification implied.'};
}
function main(argv=process.argv.slice(2)) {
 const [mode,input,output]=argv;assert(argv.length===3&&['--capture','--verify'].includes(mode),'mode input output');
 const document=JSON.parse(fs.readFileSync(input));
 const result=mode==='--capture'?capture(document):{at:new Date().toISOString(),verified:verifyRows(document.rows)};
 fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx'});
 console.log(JSON.stringify({at:result.at,rows:result.rows?.length,verified:result.verified}));
}
if(require.main===module)main();
module.exports={capture,verifyRows,row,main};
