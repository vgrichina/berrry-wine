'use strict';
// Discoverable unit entry; each native fragment has fixed <=8MiB memory.
// Child watchdogs also bound synchronous Wasm/observer failures.
const assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const owned=!process.env.SHADOW_NULL_TEST_OUTPUT;
const out=process.env.SHADOW_NULL_TEST_OUTPUT||fs.mkdtempSync(path.join(require('node:os').tmpdir(),'shadow-null-suite-'));
try {
for(const file of ['test-shadow-man-null-capture.cjs','shadow-man-null-actual-paths.cjs','shadow-man-null-repair.cjs','shadow-man-null-fresh-selection.cjs']) {
 const r=cp.spawnSync(process.execPath,[path.join(__dirname,file)],{env:{...process.env,SHADOW_NULL_TEST_OUTPUT:out},encoding:'utf8',timeout:15000});
 process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
 assert.equal(r.status,0,`${file}: ${r.error||r.signal||'failed'}`);
}

} finally { if(owned)fs.rmSync(out,{recursive:true,force:true}); }
