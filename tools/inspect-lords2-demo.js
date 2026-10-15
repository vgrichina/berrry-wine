#!/usr/bin/env node
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto'), assert = require('assert/strict');
const {parseListing, pe} = require('./acquire-army-men-demo');
const dir = process.argv[2];
assert(path.isAbsolute(dir));
const source = path.join(dir, 'payload/lorddemo.exe');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(fs.readFileSync(source)), '02845e9043dcb74dfa7016992d5b03ee42fddd63c829f8fcd583f73c8c7aad0e');
const run = args => cp.execFileSync('7z', args, {encoding:'utf8', timeout:60000, maxBuffer:8*1024*1024});
const listing = run(['l','-slt',source]);
const inventory = parseListing(listing);
fs.writeFileSync(path.join(dir,'inner-listing.txt'),listing);
assert(!fs.existsSync(path.join(dir,'installer')));
run(['t',source]); run(['x','-y','-o'+path.join(dir,'installer'),source]);
const files = inventory.members.map(m => {
  assert.equal(m.Folder,'-'); const b=fs.readFileSync(path.join(dir,'installer',m.Path)); assert.equal(b.length,+m.Size);
  return {path:m.Path,size:b.length,sha256:sha(b),pe:pe(b)};
});
fs.writeFileSync(path.join(dir,'installer-hashes.json'),JSON.stringify(files,null,2)+'\n');
console.log(JSON.stringify(files,null,2));
for(const name of ['README.TXT','INSTALL.BAT']) console.log(name+'\n'+fs.readFileSync(path.join(dir,'installer',name),'latin1'));
const inner = path.join(dir,'installer/L2DEMO.EXE');
assert.equal(sha(fs.readFileSync(inner)), '3429ae27a800e7fbfd341aeac4cb93c29dd495056ac33952aef03af71cd5c35e');
const innerListing = run(['l','-slt',inner]), innerInventory = parseListing(innerListing);
fs.writeFileSync(path.join(dir,'game-listing.txt'),innerListing);
assert(!fs.existsSync(path.join(dir,'original')));
run(['t',inner]); run(['x','-y','-o'+path.join(dir,'original'),inner]);
const originals = innerInventory.members.filter(m=>m.Folder!=='+' ).map(m=>{
  const p=path.join(dir,'original',m.Path); assert(fs.lstatSync(p).isFile());
  const b=fs.readFileSync(p); assert.equal(b.length,+m.Size);
  let header=pe(b); if(header?.mz){const off=b.readUInt32LE(60);header={...header,signature:b.toString('ascii',off,off+2)};}
  return {path:m.Path,size:b.length,sha256:sha(b),header};
});
fs.writeFileSync(path.join(dir,'original-hashes.json'),JSON.stringify(originals,null,2)+'\n');
console.log(JSON.stringify({files:originals.length,bytes:originals.reduce((n,f)=>n+f.size,0),executables:originals.filter(f=>f.header)},null,2));
