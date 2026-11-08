'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),cp=require('node:child_process');
const {createLogs}=require('./native-command-log.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'native-gzip-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('first append and every later prefix are independently readable gzip; original SHA and byte count match',t=>{
 const dir=fixture(t),logs=createLogs(dir),parts=[Buffer.from('first\n'),Buffer.from([0,255,128]),Buffer.alloc(200000,97)];
 for(let i=0;i<parts.length;i++){logs.append('browser.jsonl',parts[i]);assert.deepEqual(zlib.gunzipSync(fs.readFileSync(dir+'/browser.jsonl.gz')),Buffer.concat(parts.slice(0,i+1)));assert(!fs.existsSync(dir+'/browser.jsonl'));}
 const rows=logs.close(),bytes=Buffer.concat(parts);assert.equal(rows[0].originalBytes,bytes.length);assert.equal(rows[0].originalSha256,crypto.createHash('sha256').update(bytes).digest('hex'));assert.equal(rows[0].members,3);assert.throws(()=>logs.append('late','no'),/closed/);
});
test('actual child stdout and stderr drain before receipt, including output larger than pipe capacity',async t=>{
 const dir=fixture(t),logs=createLogs(dir),child=cp.spawn(process.execPath,['-e',"process.stdout.write(Buffer.alloc(1048576,97));process.stderr.write('unique stderr\\n')"],{stdio:['ignore','pipe','pipe']});
 logs.attach('chrome.stdout',child.stdout);logs.attach('chrome.stderr',child.stderr);
 const receipt=await logs.drainStreams();assert.deepEqual(receipt,{streams:2,eof:true});
 const rows=logs.close();assert.equal(rows.length,2);assert.deepEqual(zlib.gunzipSync(fs.readFileSync(dir+'/chrome.stdout.gz')),Buffer.alloc(1048576,97));assert.equal(zlib.gunzipSync(fs.readFileSync(dir+'/chrome.stderr.gz')).toString(),'unique stderr\n');
});
test('failed stream cannot qualify as drained; invalid paths and duplicate streams refuse',async t=>{
 const dir=fixture(t),logs=createLogs(dir),stream=new (require('node:stream').PassThrough)();
 assert.throws(()=>logs.append('../outside','no'),/invalid/);logs.attach('chrome.stderr',stream);assert.throws(()=>logs.attach('chrome.stderr',stream),/duplicate/);
 stream.destroy(Error('injected source failure'));await assert.rejects(logs.drainStreams(),/injected/);logs.close();
});
