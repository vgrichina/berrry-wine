'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const {waitForEndpoint,parseActivePort}=require('./mw3-devtools-endpoint.cjs');
const {waitForBrowserEndpoint}=require('./native-browser-endpoint.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));

test('strict parser refuses empty, partial, invalid port and extra lines',()=>{
  for(const raw of ['', '40023', '40023\n', '0\n/devtools/browser/a\n',
    '65536\n/devtools/browser/a\n', '40023\n/devtools/browser/a\nextra'])
    assert.throws(()=>parseActivePort(raw));
});

// Fault injection controls the publication read by the consumer, using the
// endpoint of a real Chrome child. It does not claim Chrome naturally writes
// these exact intermediate snapshots or reproduce the prior run's cause.
for(const mode of ['empty-partial-delayed','invalid-timeout','process-death']){
  test('real Chrome publication control: '+mode,{skip:!process.env.MW3_REAL_CHROME},async t=>{
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mw3-endpoint-'));
    const profile=path.join(dir,'chrome'),admission=path.join(dir,'admission');
    await fs.mkdir(admission);
    const child=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox',
      '--disable-dev-shm-usage','--no-first-run','--remote-debugging-port=0',
      '--user-data-dir='+profile,'about:blank'],{stdio:['ignore','pipe','pipe']});
    const output={stdout:'',stderr:''},eof={stdout:false,stderr:false};
    for(const name of ['stdout','stderr']){child[name].on('data',b=>output[name]+=b);child[name].on('end',()=>eof[name]=true);}
    const closed=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal,actualParentWait:true,separateEOF:eof})));
    let receipt,events=[],endpoint,writeTask;
    t.after(async()=>{
      if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');
      receipt=await closed;
      if(writeTask)await writeTask;
      assert(eof.stdout&&eof.stderr);
      if(process.env.MW3_ENDPOINT_EVIDENCE){
        await fs.writeFile(path.join(process.env.MW3_ENDPOINT_EVIDENCE,mode+'.json'),JSON.stringify({mode,events,endpoint,receipt,output},null,2));
      }
      await fs.rm(dir,{recursive:true,force:true});
    });
    const live=await waitForBrowserEndpoint({profile,browser:child,deadline:Date.now()+15000,pollMs:10});
    const raw=await fs.readFile(path.join(profile,'DevToolsActivePort'));
    assert.equal(parseActivePort(raw.toString()).debugPort,live.debugPort);
    const file=path.join(admission,'DevToolsActivePort');
    const options={deadline:Date.now()+1000,timeoutMs:1000,pollMs:5,record:r=>events.push(r)};
    if(mode==='empty-partial-delayed'){
      await fs.writeFile(file,'');
      let completed=false;
      const pending=waitForEndpoint(file,child,options).then(v=>{completed=true;return v;});
      writeTask=(async()=>{
        await wait(50);assert.equal(completed,false);await fs.writeFile(file,live.debugPort+'\n');
        await wait(50);assert.equal(completed,false);await fs.writeFile(file,live.debugPort+'\n'+live.browserPath.slice(0,-8));
        await wait(50);assert.equal(completed,false);await fs.writeFile(file,raw);
      })();
      endpoint=await pending;await writeTask;
      assert.equal(endpoint.debugPort,live.debugPort);assert.equal(endpoint.browserPath,live.browserPath);
      assert(events.some(e=>e.rawBase64===''));
      assert(events.some(e=>e.rawBase64===Buffer.from(live.debugPort+'\n').toString('base64')));
      // A valid pair actually addresses this live browser.
      const version=await (await fetch('http://127.0.0.1:'+endpoint.debugPort+'/json/version')).json();
      assert(version.webSocketDebuggerUrl.endsWith(endpoint.browserPath));
    }else if(mode==='invalid-timeout'){
      await fs.writeFile(file,'0\n/devtools/browser/missing');
      const began=Date.now();options.deadline=began+100;options.timeoutMs=10000;
      await assert.rejects(waitForEndpoint(file,child,options),/immutable deadline/);
      assert(Date.now()-began<1000);assert.equal(events.at(-1).rawBase64,Buffer.from('0\n/devtools/browser/missing').toString('base64'));
    }else{
      await fs.writeFile(file,'');
      const pending=waitForEndpoint(file,child,options);
      child.kill('SIGTERM');
      await assert.rejects(pending,/Chrome exited before DevTools readiness/);
      await closed;
      await fs.writeFile(file,raw);
      await assert.rejects(waitForEndpoint(file,child,options),/Chrome exited before DevTools readiness/);
    }
  });
}
