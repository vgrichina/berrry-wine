// Execute the actual observer against synthetic VFS, with real storage export.
'use strict';
const fs=require('fs'),assert=require('assert'),vm=require('vm'),path=require('path');
const R=process.env.SHADOW_ROOT,F=R+'/fixed',base=R+'/mutable/output/save-gameplay/observer-repair-fixtures';
fs.mkdirSync(base);const source=fs.readFileSync(F+'/settings-observer-repaired.cjs','utf8');
let seq=0;const rejected=[];
function setup(name){const out=base+'/'+name;fs.mkdirSync(out);const host={createHostImports:c=>({})};const sandbox={require(spec){if(spec===R+'/immutable/runtime/lib/host-imports')return host;return require(spec);},process:{env:{SHADOW_SESSION_OUTPUT:out},argv:[],pid:process.pid},Buffer};sandbox.globalThis=sandbox;return {out,host,sandbox};}
function load(t,src=source){vm.runInNewContext(src,t.sandbox,{filename:'settings-observer.cjs'});}
const t=setup('real-fixture');load(t);const files=new Map([['c:\\test.ini',{data:Buffer.from('original')}],['c:\\program files\\acclaim entertainment\\shadowman\\settings.ini',{data:Buffer.from('defaults')}]]);t.host.createHostImports({vfs:{files}});
assert.equal(t.sandbox.__shadowCapture('before').changed.length,0);files.get('c:\\test.ini').data=Buffer.from('actual-change');files.get('c:\\program files\\acclaim entertainment\\shadowman\\settings.ini').data=Buffer.from('nested-change');const after=t.sandbox.__shadowCapture('after');assert.equal(after.changed.length,2);assert.equal(fs.readFileSync(t.out+'/state-after/vfs/test.ini','utf8'),'actual-change');assert.equal(fs.readFileSync(t.out+'/state-after/vfs/program files/acclaim entertainment/shadowman/settings.ini','utf8'),'nested-change');assert.equal(files.size,2);assert.equal(files.get('c:\\test.ini').data.toString(),'actual-change');assert.equal(after.guestMutation,false);
const bad=['c:\\..\\escape.ini','c:\\safe\\..\\escape.ini','d:\\test.ini','/tmp/test.ini','\\\\server\\share\\test.ini','c:test.ini','c:/test.ini','c:\\\\test.ini','c:\\safe/../../escape','c:\\safe\\.\\test.ini','c:\\test.ini\\','c:\\safe\\test.ini:stream','c:\\%2e%2e\\escape','c:\\.. \\escape','c:\\safe\\nul\u0000.ini','c:\\safe\\test?.ini'];
for(const guest of bad){const x=setup('bad-'+seq++);load(x);x.host.createHostImports({vfs:{files:new Map([[guest,{data:Buffer.from('reject')} ]])}});assert.throws(()=>x.sandbox.__shadowCapture('before'),/unsafe diagnostic guest path/);assert.deepEqual(fs.readdirSync(x.out),[]);rejected.push(guest);}
for(const label of ['../escape','/tmp/escape','x/y',''])assert.throws(()=>t.sandbox.__shadowCapture(label),/invalid diagnostic capture/);
// Reject output traversal, prefix confusion and a symlink to an outside directory.
for(const out of [base+'/../escape',R+'/mutable/output/save-gameplay-escape/test','/tmp/observer-escape']){const x=setup('out-'+seq++);x.sandbox.process.env.SHADOW_SESSION_OUTPUT=out;assert.throws(()=>load(x));}
const x=setup('link-holder');fs.symlinkSync('/tmp',x.out+'/link');x.sandbox.process.env.SHADOW_SESSION_OUTPUT=x.out+'/link';assert.throws(()=>load(x),/unsafe diagnostic destination/);
// A preexisting state symlink cannot redirect capture output.
fs.symlinkSync('/tmp',t.out+'/state-symlink');assert.throws(()=>t.sandbox.__shadowCapture('symlink'),/EEXIST/);
// Exact historical source must still fail the ordinary changed-path fixture.
const old=setup('historical-control');load(old,fs.readFileSync(F+'/settings-observer.cjs','utf8'));const oldFiles=new Map([['c:\\test.ini',{data:Buffer.from('original')}]]);old.host.createHostImports({vfs:{files:oldFiles}});old.sandbox.__shadowCapture('before');oldFiles.get('c:\\test.ini').data=Buffer.from('actual-change');assert.throws(()=>old.sandbox.__shadowCapture('after'),/unsafe diagnostic guest path/);
console.log(JSON.stringify({passAll:true,realFixture:true,nestedSingleSeparators:true,readonlyGuestCapture:true,actualStorageExport:true,rejectedPaths:rejected,labelRejects:4,outputRejects:4,stateSymlinkRejected:true,historicalSourceRejected:true}));
