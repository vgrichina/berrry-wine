'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
test('normal staged graph finalizer verifies actual static HTTP bytes',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mw3-preparation-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(root+'/index.html','fresh ordinary graph');const b=fs.readFileSync(root+'/index.html');
 const files=[{path:'index.html',size:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}];
 const p={commit:'git-identity',files,uploadFiles:files,httpPins:[{url:'/index.html',size:1,sha256:'stale'}]};
 fs.writeFileSync(root+'/pins.json',JSON.stringify(p));
 cp.execFileSync(process.execPath,[path.resolve(__dirname,'mw3-preparation.cjs'),root+'/pins.json',root]);
 const current=JSON.parse(fs.readFileSync(root+'/pins.json'));assert.deepEqual(current.files,files);assert.equal(current.commit,p.commit);
 const server=await require('../test/static-server.js').startStaticServer({root});t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r)}));
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/index.html');
 const actual=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200);assert.equal(actual.length,current.httpPins[0].size);assert.equal(crypto.createHash('sha256').update(actual).digest('hex'),current.httpPins[0].sha256);
});
