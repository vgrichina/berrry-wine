'use strict';
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const donor='/home/user/wine-assembly-shadow-man-null-hook-independent-review-oct23';
const dir=path.join(donor,'docs/re-notes/shadow-man-null-hook-independent-review-20261023');
const wasm=path.join(dir,'original-replay-fixture.wasm'),driver=path.join(dir,'negative-driver.cjs'),preload=path.join(donor,'tools/shadow-man-null-preload.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(hash(fs.readFileSync(preload)),'49f59e8183e6e7b0c94ad8041a2544e33dc00c2211d67007a540a03f656fa2d4');
const results=[];
for(const mode of ['normal','wrong-module']){
 const output=path.join(__dirname,'old-'+mode+'.jsonl');try{fs.unlinkSync(output);}catch(_){}
 const env={...process.env,CASE:mode,SHADOW_NULL_OUTPUT:output,SHADOW_NULL_UNTIL_ZERO:'1',SHADOW_NULL_REVISED_SHA:hash(fs.readFileSync(wasm))};
 const args=['--require',preload,driver,'--wasm='+wasm];const r=cp.spawnSync(process.execPath,args,{env,encoding:'utf8',timeout:5000});
 const oracle="require('node:assert/strict').notEqual(Number(process.argv[1]),86,'old candidate violated deferred-arm or actual-module identity contract')";
 const q=cp.spawnSync(process.execPath,['-e',oracle,String(r.status)],{encoding:'utf8',timeout:5000});
 assert.equal(r.status,86,r.stderr);assert.equal(q.status,1);
 results.push({case:mode==='normal'?'old eager instantiate arming captures ordinary zero before any selected send':'old different custom-section module falsely accepted',argv:[process.execPath,...args],exit:r.status,stderr:r.stderr,output:fs.readFileSync(output,'utf8'),inputSha256:hash(fs.readFileSync(wasm)),compiledBytesSha256:hash(mode==='wrong-module'?Buffer.concat([fs.readFileSync(wasm),Buffer.from([0,2,1,120])]):fs.readFileSync(wasm)),oracleArgv:[process.execPath,'-e',oracle,String(r.status)],oracleExit:q.status,oracleStderr:q.stderr,timeoutMs:5000});
}
fs.writeFileSync(path.join(__dirname,'old-candidate-controls.json'),JSON.stringify({exit:0,candidate:'6d145e98589caeab2d43c4bb54297d90c248b9de',results},null,2)+'\n');console.log(JSON.stringify({exit:0,results:results.map(r=>({case:r.case,actual:r.exit,oracle:r.oracleExit}))}));
