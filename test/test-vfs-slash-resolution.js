'use strict';
const assert=require('assert/strict'),path=require('path');
const {VirtualFS}=require(path.join(process.argv[2]||path.join(__dirname,'..'),'lib/filesystem'));
const v=new VirtualFS();v.cwd='c:\\work\\';
const cases=[
 ['C:/work/campaigns/','c:\\work\\campaigns'],
 ['C:/work\\campaigns/file.txt','c:\\work\\campaigns\\file.txt'],
 ['D:/data/file.txt','d:\\data\\file.txt'],
 ['/rooted/file.txt','c:\\rooted\\file.txt'],
 ['C:child/file.txt','c:\\work\\child\\file.txt'],
 ['D:child/file.txt','d:\\child\\file.txt'],
 ['child/../file.txt','c:\\work\\file.txt'],
 ['C:','c:\\work'],['D:','d:'],
];
for(const [input,expected] of cases)assert.equal(v._resolvePath(input),expected,input);
// UNC inputs remain UNC-classified before lookup; neither variant gets CWD.
// Existing canonical UNC representation is unchanged by this scoped fix.
const unc=v._resolvePath('\\\\server\\share\\dir\\file.txt');
assert.equal(v._resolvePath('//server/share/dir/file.txt'),unc);
assert(!unc.includes('c:'));assert(unc.startsWith('\\'));
v.ensureParentDirs('c:\\work\\campaigns\\bootcamp.cpn');
v.setLazyFile('c:\\work\\campaigns\\bootcamp.cpn',{size:3,load:()=>Uint8Array.from([1,2,3])});
assert.equal(v.setCurrentDirectory('C:/work/campaigns/'),true);
assert.equal(v.getCurrentDirectory(),'c:\\work\\campaigns');
const h=v.createFile('bootcamp.cpn',0x80000000,3);assert(h>0);assert.equal(v.handles.get(h).path,'c:\\work\\campaigns\\bootcamp.cpn');
assert.equal(v.setCurrentDirectory('C:/work/not-present/'),false,'missing directory remains failure');
assert.equal(v.createFile('missing.cpn',0x80000000,3),0,'missing file remains failure');
console.log('PASS slash normalization before drive/UNC/root/relative classification; actual chdir and relative file lookup; no guest');
