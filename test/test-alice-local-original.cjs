'use strict';
const assert=require('node:assert/strict');
const apps=require('../lib/apps');
const a=apps.APPS.alice_demo;
assert.equal(a.exe,'binaries/candidates/alice-demo/alice.exe');
assert.equal(a.localFileManifest,'binaries/candidates/alice-demo/.wine-assembly-browser.json');
assert.equal(a.requiredFiles,true);
assert.equal(a.relativeMouse,true);
assert.equal(a.threads,undefined,'normal Worker selection remains user controlled');
for(const key of ['args','files','startupRegistry','bigMemory'])assert.equal(a[key],undefined,key);
const rows=apps.LOCAL_CANDIDATE_APPS.filter(r=>r[0]==='alice_demo');
assert.equal(rows.length,1);assert.match(rows[0][1],/Demo.*experimental/);
const helper=require('../tools/alice-local-original.cjs');
assert.equal(helper.admissionFits(10,12,2),false);
assert.equal(helper.admissionFits(10,12.001,2),true);
assert.equal(helper.freshnessFits(10,10,true,true),false);
console.log('PASS Alice original demo registration and finite input deadline boundaries');

async function readinessControl() {
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
  const c=require('../tools/native-supervisor-common.cjs');
  const previous={R:helper.R,URL:helper.URL};
  for(const mode of ['delayed','foreign-process','held-input']) {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alice-readiness-')),commands=[];
    const server=http.createServer((req,res)=>{let body='';req.on('data',b=>body+=b);req.on('end',()=>{
      commands.push(JSON.parse(body));const ready=commands.length>1;
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,value:{contract:'native-startup-readiness-v1',ready,
        failures:ready?[]:['focus.mainTopLevel'],snapshot:{nativeProcess:{pid:process.pid+(mode==='foreign-process'?1:0)},
          physicalUp:mode!=='held-input',capture:'0x0',quit:false,screen:{w:640,h:480}},
        ordinaryOwner:{healthy:true,actorContext:true}}}));
    });});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    try {
      helper.R=dir;helper.URL='http://127.0.0.1:'+server.address().port+'/ctl';
      const at=c.now();c.save(dir,'launch.json',{at,deadline:at+360,gameplayCutoff:at+180,reserveSeconds:180});
      c.save(dir,'native-pid.json',{pid:process.pid,startToken:c.token(process.pid),at});
      if(mode==='delayed') {
        const r=await helper.waitReady('startup',2);assert.equal(r.ready,true);
        assert.equal(commands.length,2);assert(!fs.existsSync(path.join(dir,'terminal-input-failure.json')));
      }else {
        await assert.rejects(helper.waitReady('startup',2));assert.equal(commands.length,1);
        assert(fs.existsSync(path.join(dir,'terminal-input-failure.json')));
      }
      assert(commands.every(c=>c.action==='native-startup-readiness'),'preparation must not capture, bind, poll or send input');
      assert(!fs.readdirSync(dir).some(n=>n.endsWith('.png')||n==='input-owner.json'));
    }finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
  }
  Object.assign(helper,previous);console.log('PASS passive delayed readiness and foreign-process/held-input refusal; zero capture or input');
}
readinessControl().catch(e=>{console.error(e);process.exitCode=1;});
