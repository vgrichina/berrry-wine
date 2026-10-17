#!/usr/bin/env node
'use strict';
// Source-only staging/manifest preparation; never executes setup or game.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const {createRequire}=require('module');
const root=path.resolve(__dirname,'..'),source=process.argv[2];
const inventory=JSON.parse(fs.readFileSync(path.join(root,'test/candidate-corpus/lords2-demo-files.json')));
const candidate=JSON.parse(fs.readFileSync(path.join(root,'test/candidate-corpus/manifest.json'))).candidates.find(x=>x.id==='lords2-demo');
const dest=path.join(root,'test/binaries/candidates/lords2-demo');
assert(source&&path.isAbsolute(source)); assert(!fs.existsSync(dest),'new fixture destination required');
for(const f of inventory.files){const b=fs.readFileSync(path.join(source,f.path));assert.equal(b.length,f.size);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),f.sha256);}
fs.mkdirSync(dest,{recursive:true});fs.cpSync(source,path.join(dest,'original'),{recursive:true});
const script=path.join(__dirname,'fetch-candidate-corpus.js');
const context=vm.createContext({Buffer,URL,__dirname,process:{argv:['node',script,'--prepare','--id=lords2-demo']},console,require:createRequire(script),candidate,dest});
vm.runInContext(fs.readFileSync(script,'utf8').split('\n(async () => {')[0]+'\nwriteBrowserManifest(candidate,dest);',context);
const manifest=JSON.parse(fs.readFileSync(path.join(dest,'.wine-assembly-browser.json')));
assert.equal(manifest.files.length,180);
for(const f of manifest.files){assert(f.url.startsWith('original/')&&!f.url.includes('original/original/'));assert(fs.existsSync(path.join(dest,f.url)));assert.equal(f.vfsPath,'c:\\'+f.url.slice('original/'.length).replaceAll('/','\\'));}
assert(!manifest.files.some(f=>f.url==='original/SETUP.EXE'));
console.log(JSON.stringify({source,destination:dest,originalFiles:181,manifestFiles:180,setup:'original/SETUP.EXE',passed:true}));
