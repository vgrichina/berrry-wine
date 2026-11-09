'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {provider,derive,assertClosure}=require('./staging');
const root=path.resolve(__dirname,'../..'),manifest=process.argv[2];
assert(manifest,'actual prepared manifest required');
const prepared=JSON.parse(fs.readFileSync(manifest)),upload=derive(root,manifest,['tools/warcraft3-prologue/startup-fixture.js']);
assertClosure(root,prepared,upload);
const renderer='tools/warcraft3-prologue/renderer-identity.js';
assert(prepared.files.some(p=>p.path===renderer),'actual prepared renderer provider required');
// The exact 0335 omission: all remaining pins are valid; only the subset fails.
const omitted={...upload,files:upload.files.filter(p=>p.path!==renderer)};
assert.throws(()=>assertClosure(root,prepared,omitted),/omitted or changed prepared provider: tools\/warcraft3-prologue\/renderer-identity.js/);
const changed=structuredClone(upload);changed.files.find(p=>p.path===renderer).sha256='0'.repeat(64);
assert.throws(()=>assertClosure(root,prepared,changed),/SHA\/size mismatch/);
for(const p of ['../escape','/etc/passwd','tools/../CLAUDE.md'])assert.throws(()=>provider(root,p),/outside root/);
assert.throws(()=>assertClosure(root,prepared,{...upload,files:[...upload.files,upload.files[0]]}),/duplicate provider/);
// A lexically contained path must also have a contained realpath.
const dir=fs.mkdtempSync(path.join(path.dirname(manifest),'containment-'));
try{fs.symlinkSync('/etc/passwd',dir+'/outside');assert.throws(()=>provider(root,path.relative(root,dir+'/outside')),/outside root/)}finally{fs.rmSync(dir,{recursive:true})}
console.log('Actual prepared closure PASS; omitted renderer, changed SHA, duplicate, traversal, absolute and symlink escape negatives PASS');
