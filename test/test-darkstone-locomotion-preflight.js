'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {readPinned,seedReceipts,MANIFEST}=require('../tools/darkstone-locomotion-preflight');
assert.equal(readPinned(path.join(__dirname,'../docs/fixtures/darkstone-locomotion-preservation-20261015.json'),MANIFEST).files.length,166);
const d=fs.mkdtempSync(path.join(os.tmpdir(),'darkstone-seed-'));
try {
 const old=d+'/old';fs.mkdirSync(old);
 const files=['preflight.json','build.json'].map(name=>{const p=old+'/'+name;fs.writeFileSync(p,'{}');return {path:p,sha256:crypto.createHash('sha256').update('{}').digest('hex')};});
 const receipts=seedReceipts({files},old,d+'/new');assert.equal(receipts.length,2);assert(receipts.every(r=>r.provenance.includes('not a fresh build')));
 assert.throws(()=>seedReceipts({files},old,d+'/new'));
 fs.writeFileSync(old+'/build.json','tampered');assert.throws(()=>seedReceipts({files},old,d+'/bad'));assert(!fs.existsSync(d+'/bad'));
 assert.throws(()=>readPinned(old+'/preflight.json','0'.repeat(64)));
} finally {fs.rmSync(d,{recursive:true,force:true});}
console.log('PASS admitted manifest pin, receipt copies/provenance, existing output and mutated seed rejection');
