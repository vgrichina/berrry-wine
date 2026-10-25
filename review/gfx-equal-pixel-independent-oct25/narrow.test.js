'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {verify}=require('../../tools/gfx-runtime-coverage.js');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'gfx-equal-review-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const bytes=Buffer.from('Identical synthetic retained content; no runtime authenticity claim.');
 const manifest={version:1,apps:[{app:'a',build:'build'}]};
 const evidence={version:1,records:['software','webgl'].map((backend,i)=>{
  fs.writeFileSync(path.join(root,`${i}.bin`),bytes);
  return {app:'a',build:'build',backend,kind:'runtime',run:`r${i}`,observation:'Synthetic independent constraint check.',artifact:{path:`${i}.bin`,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}};
 })};
 assert.equal(verify(manifest,evidence,root).complete,true);
 return {root,manifest,evidence,check:()=>verify(manifest,evidence,root)};
}
function allRejected(result,indices,reason){
 assert.equal(result.complete,false);
 assert.deepEqual(result.rejected.filter(r=>r.reasons.includes(reason)).map(r=>r.record),indices);
}
test('equal content cannot excuse duplicate run IDs: both reject',t=>{
 const f=fixture(t);f.evidence.records[1].run='r0';allRejected(f.check(),[0,1],'duplicate-run');
});
test('equal content cannot excuse lexically distinct paths resolving to one file',t=>{
 const f=fixture(t);fs.mkdirSync(path.join(f.root,'sub'));f.evidence.records[1].artifact.path='sub/../0.bin';allRejected(f.check(),[0,1],'reused-artifact');
});
test('equal content cannot excuse symlink aliases',t=>{
 const f=fixture(t);fs.symlinkSync('0.bin',path.join(f.root,'alias'));f.evidence.records[1].artifact.path='alias';allRejected(f.check(),[0,1],'reused-artifact');
});
test('equal-content distinct paths still require correct hashes',t=>{
 const f=fixture(t);f.evidence.records[1].artifact.sha256='0'.repeat(64);allRejected(f.check(),[1],'artifact-sha256-mismatch');
});
test('equal-content malformed duplicate app/backend poisons every competitor in either order',t=>{
 const f=fixture(t);const bad=structuredClone(f.evidence.records[0]);bad.run='r2';bad.build=null;bad.artifact.path='2.bin';fs.copyFileSync(path.join(f.root,'0.bin'),path.join(f.root,'2.bin'));
 f.evidence.records.push(bad);let r=f.check();allRejected(r,[0,2],'duplicate-app-backend');assert.equal(r.apps[0].backends[0].status,'rejected');
 f.evidence.records.reverse();r=f.check();allRejected(r,[0,2],'duplicate-app-backend');assert.equal(r.apps[0].backends[0].status,'rejected');
});
