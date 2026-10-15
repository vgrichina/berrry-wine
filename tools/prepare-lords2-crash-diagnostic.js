#!/usr/bin/env node
'use strict';
// Reproduce the diagnostic on the actual historical host, not today's full JS.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const crypto=require('crypto'),assert=require('assert/strict');
assert.equal(process.argv.length,3,'NEW_OUTPUT_FILE');
const root=path.resolve(__dirname,'..');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const old=cp.execFileSync('git',['-C',root,'show','03641536b256ec78527fee514ea2dfa4c31639e4:lib/thread-manager.js'],{encoding:'utf8',maxBuffer:1024*1024});
assert.equal(sha(old),'02265fbcd48b5fd4c8e38b7025d7c067ac558f773168e761c5e2c4f5eb993b08');
const current=fs.readFileSync(path.join(root,'lib/thread-manager.js'),'utf8');
const begin='          // Every CS counter is a per-instance global';
const end="          this._markThreadExited(handle, thread, 1, 'crash');";
const block=current.slice(current.indexOf(begin),current.indexOf(end));
assert.equal(sha(block),'c8ab320483c2e16ef558cb1692a09cd5f7300e77b1dc8bf1c4d00970b939091b');
const result=old.slice(0,old.indexOf(begin))+block+old.slice(old.indexOf(end));
assert.equal(sha(result),'fb9ee11f21b5e7bd409141deda6d9a59782b98752e60f6b15fb67730e3921642');
fs.writeFileSync(process.argv[2],result,{flag:'wx'});
console.log(JSON.stringify({sha256:sha(result),bytes:Buffer.byteLength(result)}));
