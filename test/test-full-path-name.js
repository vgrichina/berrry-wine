'use strict';
const assert=require('assert/strict');
const {VirtualFS,createFilesystemImports}=require('../lib/filesystem');
// Pure JS host-import fixture; no WASM instance or original application.
const memory=new ArrayBuffer(16384),bytes=new Uint8Array(memory),dv=new DataView(memory);
const vfs=new VirtualFS();vfs.cwd='c:\\work\\';
const host=createFilesystemImports({vfs,getMemory:()=>memory});
const input=0x100,output=0x1000,part=0x3000;
const cases=[
 ['Campaigns/','C:\\work\\campaigns\\',null],
 ['c:/work\\Mixed/','C:\\work\\mixed\\',null],
 ['C:\\work\\folder\\','C:\\work\\folder\\',null],
 ['child/../folder/','C:\\work\\folder\\',null],
 ['\\folder\\','C:\\folder\\',null],
 ['C:/','C:\\',null],['C:\\','C:\\',null],
 ['C:\\..\\','C:\\',null],
 ['report.txt','C:\\work\\report.txt','report.txt'],
 ['c:/work/folder/report.txt','C:\\work\\folder\\report.txt','report.txt'],
 ['missing/','C:\\work\\missing\\',null],
 ['folder','C:\\work\\folder','folder'],
];
for(const wide of [0,1])for(const [name,expected,filePart] of cases){
 const enc=wide?'utf16le':'latin1',unit=wide?2:1;
 bytes.fill(0xcc);bytes.set(Buffer.from(name+'\0',enc),input);
 const canonical=vfs._resolvePath(name.replace(/\//g,'\\'));
 assert.equal(vfs.getFullPathName(name),expected);
 assert.equal(vfs._resolvePath(expected),canonical,'display form does not alter lookup identity');
 const before=bytes.slice(output-1,output+(expected.length+1)*unit+1);
 for(const size of [0,expected.length]){
  dv.setUint32(part,0x12345678,true);
  assert.equal(host.fs_get_full_path_name(input,size,size?output:0,part,wide),expected.length+1);
  assert.deepEqual(bytes.slice(output-1,output+(expected.length+1)*unit+1),before,'short sizing must not write output');
  assert.equal(dv.getUint32(part,true),0x12345678,'short sizing does not write filePart');
 }
 assert.equal(host.fs_get_full_path_name(input,expected.length+1,output,part,wide),expected.length);
 assert.deepEqual(Buffer.from(bytes.slice(output,output+(expected.length+1)*unit)),Buffer.from(expected+'\0',enc));
 assert.equal(bytes[output-1],0xcc);assert.equal(bytes[output+(expected.length+1)*unit],0xcc);
 assert.equal(dv.getUint32(part,true),filePart===null?0:output+(expected.length-filePart.length)*unit);
 assert.equal(host.fs_get_full_path_name(input,260,output,0,wide),expected.length,'optional filePart');
}
// Generic directory wildcard composition from an API result, not a game bypass.
vfs.ensureParentDirs('c:\\work\\campaigns\\bootcamp.cpn');
vfs.setLazyFile('c:\\work\\campaigns\\bootcamp.cpn',{size:1,load(){throw Error('enumeration must not read bytes')}});
const search=vfs.findFirstFile(vfs.getFullPathName('Campaigns/')+'*.*');assert(search.handle);assert.equal(search.entry.name,'.');assert.equal(vfs.findNextFile(search.handle).name,'..');vfs.findClose(search.handle);
for(const wide of [0,1]){bytes.fill(0xcc);bytes[input]=0;bytes[input+1]=0;assert.equal(host.fs_get_full_path_name(input,260,output,part,wide),0);assert.equal(bytes[output],0xcc);}
console.log('PASS GetFullPathName A/W trailing separators, roots, relative/mixed paths, TCHAR capacities, file-part pointers and wildcard composition; pure JS');
