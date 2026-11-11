'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const crypto = require('node:crypto'), cp = require('node:child_process');
const {prepareHttpPins} = require('./mw3-runtime-http-pins.cjs');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

test('fresh staged source gets matching ordinary HTTP pins; source and guard remain intact', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mw3-http-pins-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  fs.mkdirSync(root+'/lib');fs.mkdirSync(root+'/build');
  const files = ['index.html','lib/apps.js','build/wine-assembly.wasm'].map(name => {
    const bytes = Buffer.from('fresh staged input '+name);
    fs.writeFileSync(root+'/'+name,bytes);
    return {path:name,size:bytes.length,sha256:sha(bytes)};
  });
  const original = {commit:'retained-source-identity',files,uploadFiles:files.map(r=>({...r})),
    httpPins:files.map(r=>({url:'/'+r.path,size:1,sha256:'stale'}))};
  const before = JSON.stringify(original);
  const server = await require('../test/static-server.js').startStaticServer({root});
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
  const base = 'http://127.0.0.1:'+server.address().port;
  const response = Buffer.from(await (await fetch(base+'/index.html')).arrayBuffer());
  assert.notEqual(sha(response),original.httpPins[0].sha256);
  const prepared = prepareHttpPins(original,root);
  assert.equal(JSON.stringify(original),before);
  assert.equal(prepared.commit,original.commit);
  assert.deepEqual(prepared.files,original.files);
  assert.deepEqual(prepared.uploadFiles,original.uploadFiles);
  for (const pin of prepared.httpPins) {
    const response = await fetch(base+pin.url), bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status,200);assert.equal(bytes.length,pin.size);assert.equal(sha(bytes),pin.sha256);
  }
  for (const mutate of [
    p=>p.uploadFiles.pop(),p=>p.files.push({...p.files[0]}),
    p=>p.files[0].sha256='0'.repeat(64),p=>p.uploadFiles[0].size++,
    p=>p.httpPins.push({...p.httpPins[0]}),p=>p.httpPins[0].url='/../index.html',
    p=>p.httpPins[0].url='/index.html?skip=1',p=>p.httpPins[0].url='/%69ndex.html',
  ]) {
    const bad=structuredClone(original);mutate(bad);assert.throws(()=>prepareHttpPins(bad,root));
  }
  const input=root+'/input.json',output=root+'/output.json';fs.writeFileSync(input,before);
  const argv=[path.resolve(__dirname,'mw3-runtime-http-pins.cjs'),input,output,root];
  cp.execFileSync(process.execPath,argv);
  assert.deepEqual(JSON.parse(fs.readFileSync(output)),prepared);
  assert.equal(fs.readFileSync(input,'utf8'),before);
  assert.throws(()=>cp.execFileSync(process.execPath,argv,{stdio:'pipe'}));
  assert.deepEqual(JSON.parse(fs.readFileSync(output)),prepared);
});
