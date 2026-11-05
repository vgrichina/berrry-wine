'use strict';
// Run after gate only. The unchanged public-x86 fixture supplies the pixel
// oracle; diagnostic requests target its real owning render endpoint.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.env.GROUND_ROOT||path.resolve(__dirname,'..'),out=process.env.GROUND_EVIDENCE;
assert(out,'GROUND_EVIDENCE required');fs.mkdirSync(out,{recursive:true});
const base=require(root+'/test/test-legacy-texture-rendered-contract');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function recordServed(server,file){
 server.prependListener('request',(req,res)=>{
  if(!/\.(?:js|wasm)(?:\?|$)/.test(req.url))return;
  const hash=crypto.createHash('sha256');let bytes=0;
  const track=(chunk,encoding)=>{if(chunk==null)return;const b=typeof chunk==='string'?Buffer.from(chunk,typeof encoding==='string'?encoding:undefined):Buffer.from(chunk);hash.update(b);bytes+=b.length;};
  const write=res.write,end=res.end;
  res.write=function(chunk,encoding){track(chunk,encoding);return write.apply(this,arguments);};
  res.end=function(chunk,encoding){track(chunk,encoding);return end.apply(this,arguments);};
  res.once('finish',()=>fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),url:req.url,status:res.statusCode,bytes,sha256:hash.digest('hex')})+'\n'));
 });
}

const fixtureSource=base.browserFixture.toString().replace(
 '        const post=port.postMessage.bind(port);',
 `        globalThis.groundRequest=(action,options)=>new Promise((resolve,reject)=>{
          const requestId='control-'+Math.random(),timer=setTimeout(()=>{port.removeEventListener('message',receive);reject(Error('ground diagnostic timeout'));},5000);
          function receive(event){const m=event.data;if(m.t!=='legacy-ground-diagnostic'||m.requestId!==requestId)return;
            clearTimeout(timer);port.removeEventListener('message',receive);m.error?reject(Error(m.error)):resolve(m.receipt);}
          port.addEventListener('message',receive);port.postMessage({t:'legacy-ground-diagnostic',action,options,requestId});
        });
        const post=port.postMessage.bind(port);`).replace(
 '    if(!config.stateblocks&&!config.immediate)for(const state of config.states)',
 `    await setState(config.states[0]);await geometry(config.samples[0].uv);await draw();
    await observe('diagnostic public warmup',config.samples[0],config.states[0]);
    if(config.groundArmed){
      let error;try{await groundRequest('arm',{x:-1,y:2});}catch(e){error=String(e);}
      check(error?.includes('invalid ground diagnostic x'),'malformed diagnostic rejected: '+error);
      evidence.armed=await groundRequest('arm',{x:2,y:2,maxRecords:4,timeoutMs:5000});
    }
    if(!config.stateblocks&&!config.immediate)for(const state of config.states)`).replace(
 "    if(mode==='worker'&&!config.stateblocks&&!config.immediate){",
 `    evidence.ground=await groundRequest('read');
    if(config.groundArmed){
      const copy=await groundRequest('read');copy.records[0].after.fill(0);
      evidence.groundImmutable=JSON.stringify((await groundRequest('read')).records)===JSON.stringify(evidence.ground.records);
    }
    if(mode==='worker'&&!config.stateblocks&&!config.immediate){`);
assert.notEqual(fixtureSource,base.browserFixture.toString());
const fixture=(0,eval)('('+fixtureSource+')');
const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host','render-worker','gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
const pe=fs.readFileSync(root+'/test/binaries/calc.exe');
const config={...base.plan(),imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52),thunkBase:require(root+'/lib/region-map.generated').BASE.THUNK_BASE,
 factoryId:require(root+'/src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id};
const evidence={startedAt:new Date().toISOString(),fixtureSHA256:sha(Buffer.from(fixtureSource)),results:[]};
let wasm,server,browser,page,timer;
(async()=>{
 try{
  server=await require(root+'/test/static-server').startStaticServer({root,crossOriginIsolated:true,handleRequest(req,res){
   res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
   if(req.url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
   if(req.url==='/ground-control'){res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;}
   return false;
  }});evidence.server=server.address();recordServed(server,path.join(out,'http-served.jsonl'));
  browser=await require(root+'/node_modules/puppeteer').launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
  const child=browser.process();evidence.process={pid:child.pid,profile:child.spawnargs.find(s=>s.startsWith('--user-data-dir='))?.slice(16)};
  evidence.endpoint=browser.wsEndpoint();evidence.browser=await browser.version();child.once('exit',(code,signal)=>evidence.process.exit={code,signal});
  fs.writeFileSync(path.join(out,'identity.json'),JSON.stringify({callerPid:process.pid,process:evidence.process,endpoint:evidence.endpoint,server:evidence.server},null,2)+'\n');
  timer=setTimeout(()=>{evidence.timeout=true;browser.close().catch(()=>{});},480000);
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
   wasm=fs.readFileSync(root+'/build/'+name);const rows=[];
   for(const armed of [false,true]){
    page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/ground-control');
    let result;try{result=await page.evaluate(fixture,'worker',{...config,groundArmed:armed},base.oracle.toString());}
    catch(e){evidence.partial=await page.evaluate(()=>globalThis.legacyTextureEvidence||null);throw e;}
    const row={name,moduleHash:sha(wasm),armed,result};rows.push(row);evidence.results.push(row);
    await page.screenshot({path:path.join(out,name+'-'+(armed?'armed':'disabled')+'.png'),fullPage:true});
    await page.close();page=null;
    if(!armed)assert.equal(result.ground,null,'disabled has no diagnostic recorder');
    else{
     const d=result.ground;assert.equal(d.kind,'legacy-owning-ground-diagnostic');assert.equal(d.records.length,4);assert.equal(d.reason,'record-limit');
     assert.equal(result.groundImmutable,true,'read receipt cannot mutate recorder');
     for(const [i,r] of d.records.entries()){
      assert.equal(r.completed,true,'actual GPU submission completed');assert.equal(r.source.command.ordinal,0);assert(r.source.command.sequence>0);
      assert.equal(r.source.vertexType,3);assert.equal(r.source.primitive,4);assert.equal(r.hits.length,1);
      assert.deepEqual(r.after.slice(0,3),result.observations[i+1].expected,'independent public COM oracle vs completed owning GPU target');
      assert(r.texture.samples.length>0,'owning native texel samples');
      for(const sample of r.texture.samples){
       const expected=config.texture[sample.xy[1]*2+sample.xy[0]];
       assert.deepEqual(sample.native,[expected[2],expected[1],expected[0],255],'public Lock native texel identity');
       assert.deepEqual(sample.decoded,[...expected,255],'independent native to RGBA decoding');
      }
     }
    }
    console.log(JSON.stringify({name,armed,records:result.ground?.records.length,draws:result.drawCount,status:result.status}));
   }
   assert.deepEqual(rows[0].result.observations.map(r=>r.actual),rows[1].result.observations.map(r=>r.actual),'diagnostics preserve all public target pixels');
   for(const key of ['drawCalls','draws','mergedDraws','fences','syncs','fallbacks','errors'])
    assert.equal(rows[0].result.stats[key],rows[1].result.stats[key],'diagnostics preserve '+key);
  }
  evidence.status='PASS';
 }catch(e){evidence.status='FAIL';evidence.error=e.stack;throw e;}
 finally{
  clearTimeout(timer);if(page)await page.close();if(browser)await browser.close();if(server)await require(root+'/test/static-server').closeServer(server);
  evidence.endedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(evidence,null,2)+'\n');
  if(browser&&!evidence.timeout)assert.deepEqual(evidence.process.exit,{code:0,signal:null});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
