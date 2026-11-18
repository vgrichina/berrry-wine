'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const {sha, recover, diagnose} = require('../tools/aow2-required-body-boundary.cjs');
test('missing or changed current source recovers exact immutable Git plus patch', () => {
  const patch = 'diff --git a/lib/a.js b/lib/a.js\n--- a/lib/a.js\n+++ b/lib/a.js\n@@ -1 +1 @@\n-old\n+new\n';
  for (const current of [null, Buffer.from('foreign')]) {
    const r = recover({name:'lib/a.js', expected:sha('new\n'), current, readGit:()=>Buffer.from('old\n'), patch});
    assert.equal(r.bytes.toString(), 'new\n');
  }
  assert.throws(()=>recover({name:'binaries/dlls/oleaut32.dll', expected:sha('new'), current:null, readGit:()=>Buffer.from('new'), patch:''}), /media/);
  assert.throws(()=>recover({name:'lib/a.js', expected:sha('wrong'), current:null, readGit:()=>Buffer.from('old\n'), patch}), /hash/);
});
test('EOF never substitutes for browser completion after abort or timeout', () => {
  const caller = [{event:'read-resolved',bytes:12,done:false},{event:'read-resolved',bytes:0,done:true}];
  const base={caller, expectedBytes:12};
  assert.equal(diagnose({...base, network:[]}).accepted,false);
  const r=diagnose({...base,network:[{event:'Network.loadingFailed',row:{errorText:'net::ERR_ABORTED',canceled:true}}]});
  assert.equal(r.eof,true); assert.equal(r.accepted,false); assert.equal(r.cause,'UNKNOWN');
  assert.equal(diagnose({...base,network:[{event:'Network.loadingFinished'}]}).accepted,true);
  assert.equal(diagnose({...base,expectedBytes:13,network:[{event:'Network.loadingFinished'}]}).accepted,false);
});
