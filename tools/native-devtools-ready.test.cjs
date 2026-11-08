'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {waitForDevTools}=require('./native-devtools-ready.cjs');
const alive={exitCode:null,signalCode:null};
async function fixture(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'q2-devtools-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return path.join(dir,'DevToolsActivePort');}
test('delayed real endpoint publication is accepted within immutable deadline',async t=>{
 const file=await fixture(t),rows=[];await assert.rejects(fs.readFile(file),{code:'ENOENT'});
 const publish=(async()=>{await new Promise(r=>setTimeout(r,60));await fs.writeFile(file,'42799\n/devtools/browser/test-id\n');})();
 const value=await waitForDevTools({file,browser:alive,deadline:Date.now()+1000,pollMs:5,record:r=>rows.push(r)});await publish;
 assert.equal(value.debugPort,42799);assert.equal(value.browserPath,'/devtools/browser/test-id');assert(value.elapsedMs>=40);assert.equal(rows[0].kind,'devtools-ready');
});
test('partial endpoint is never returned; complete publication is required',async t=>{
 const file=await fixture(t);await fs.writeFile(file,'42799\n');
 const publish=(async()=>{await new Promise(r=>setTimeout(r,30));await fs.writeFile(file,'42799\n/devtools/browser/complete\n');})();
 const value=await waitForDevTools({file,browser:alive,deadline:Date.now()+1000,pollMs:5});await publish;assert.equal(value.browserPath,'/devtools/browser/complete');
});
test('missing or malformed endpoint fails at finite deadline without any endpoint',async t=>{
 const file=await fixture(t),rows=[];await fs.writeFile(file,'70000\n/invalid\n');
 await assert.rejects(waitForDevTools({file,browser:alive,deadline:Date.now()+35,pollMs:5,record:r=>rows.push(r)}),/deadline.*invalid endpoint.*no replay/);assert.equal(rows[0].noReplay,true);
});
test('actual terminal child status fails immediately without waiting for startup cap',async t=>{
 const file=await fixture(t),child=require('node:child_process').spawn(process.execPath,['-e','process.exit(7)'],{stdio:'ignore'});
 await new Promise(resolve=>child.once('close',resolve));assert.equal(child.exitCode,7);
 await assert.rejects(waitForDevTools({file,browser:child,deadline:Date.now()+1000}),/terminated.*no replay/);
});
test('missing publication obeys the cap and read errors propagate',async t=>{
 const file=await fixture(t);await assert.rejects(waitForDevTools({file,browser:alive,deadline:Date.now()+30,pollMs:5}),/deadline.*not published/);
 await assert.rejects(waitForDevTools({file:path.dirname(file),browser:alive,deadline:Date.now()+100}),{code:'EISDIR'});
 await assert.rejects(waitForDevTools({file,browser:alive,deadline:0}),/invalid.*deadline/);
});
