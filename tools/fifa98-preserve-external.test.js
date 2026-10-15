'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {capture,verifyRows,row,main}=require('./fifa98-preserve-external');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fifa-preserve-'));
try {
 const source=dir+'/source',evidence=dir+'/evidence';fs.mkdirSync(source);fs.mkdirSync(evidence);
 fs.writeFileSync(source+'/a','original');fs.symlinkSync('a',source+'/link');fs.writeFileSync(evidence+'/r','receipt');
 const manifest=dir+'/manifest.json';fs.writeFileSync(manifest,JSON.stringify({source:[row(source+'/a'),row(source+'/link')]}));
 const config={manifests:[{path:manifest,sha256:row(manifest).sha256,keys:['source']}],roots:[evidence]};
 const before=fs.readFileSync(source+'/a','utf8'),snapshot=capture(config);assert.equal(snapshot.rows.length,4);assert.equal(verifyRows(snapshot.rows),4);assert.equal(fs.readFileSync(source+'/a','utf8'),before);
 assert.throws(()=>capture({...config,manifests:[{...config.manifests[0],sha256:'0'.repeat(64)}]}));
 fs.writeFileSync(source+'/a','changed');assert.throws(()=>verifyRows(snapshot.rows));assert.throws(()=>capture(config));fs.writeFileSync(source+'/a','original');
 fs.unlinkSync(source+'/link');fs.symlinkSync('r',source+'/link');assert.throws(()=>verifyRows(snapshot.rows));fs.unlinkSync(source+'/link');fs.symlinkSync('a',source+'/link');
 const input=dir+'/config.json',output=dir+'/out.json';fs.writeFileSync(input,JSON.stringify(config));main(['--capture',input,output]);assert.throws(()=>main(['--capture',input,output]),/EEXIST/);
 assert.throws(()=>capture({...config,pins:[{path:source+'/a',sha256:'0'.repeat(64)}]}));
 console.log('PASS pinned manifests, source/evidence/symlink preservation, tamper rejection, fresh output');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
