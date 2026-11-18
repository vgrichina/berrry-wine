'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),
  cp=require('node:child_process'),path=require('node:path'),http=require('node:http'),{Writable}=require('node:stream');
const {create,encodeXwd,captureWhole}=require('../tools/browser-transients.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const free=()=>{const s=fs.statfsSync('/home');return s.bavail*s.bsize;};
const allocated=p=>{const st=fs.lstatSync(p);return st.blocks*512+(st.isDirectory()?fs.readdirSync(p).reduce((n,f)=>n+allocated(path.join(p,f)),0):0);};

test('startup failure, early exit, cancel and slow writer drain precede idempotent cleanup',async()=>{
  for(const mode of ['startup-failure','early-exit','cancel','writer-drain']){
    const w=create();let drained=false;
    const sink=new Writable({write(b,e,cb){setTimeout(cb,10);},final(cb){setTimeout(()=>{drained=true;cb();},100);}});
    const p=mode==='startup-failure'?cp.spawn('/nonexistent-wine-browser',[],{stdio:['ignore','pipe','pipe']}):
      cp.spawn(process.execPath,['-e',mode==='cancel'?'process.stdout.write("ready");setInterval(()=>{},100)':'process.stdout.write("output");'],{stdio:['ignore','pipe','pipe']});
    p.stdout.pipe(sink);p.stderr.resume();const joined=w.watch(p,[sink]);
    let done=false;const cleanup=w.cleanup().then(r=>{done=true;return r;});
    await sleep(20);assert(!done);assert(fs.existsSync(w.root));
    if(mode==='cancel')p.kill('SIGTERM');
    const receipt=await joined,result=await cleanup;assert(drained);assert(result.removed);
    assert.strictEqual(await w.cleanup(),result);assert(receipt.writersDrained);
    console.log(JSON.stringify({mode,receipt,result}));
  }
});

test('unique download bytes survive cross-filesystem cleanup; collisions preserve workspace',async()=>{
  const out=fs.mkdtempSync('/tmp/wine-retain-');
  try{
    const w=create(),bytes=Buffer.from('unique guest output\0\xff');
    fs.writeFileSync(w.downloads+'/save.bin',bytes,{flag:'wx'});
    const result=await w.cleanup(out);assert.deepEqual(fs.readFileSync(out+'/browser-downloads/save.bin'),bytes);
    assert.equal(result.retained.length,1);assert(result.removed);
    const held=create();fs.writeFileSync(held.downloads+'/save.bin','different');
    await assert.rejects(held.cleanup(out),{code:'EEXIST'});assert(fs.existsSync(held.root));
    assert.deepEqual(fs.readFileSync(out+'/browser-downloads/save.bin'),bytes);
    // Test-owned failed retention has no child and no unique unretained bytes.
    assert.equal(fs.readFileSync(held.downloads+'/save.bin','utf8'),'different');
    fs.writeFileSync(out+'/collision-preserved.bin',fs.readFileSync(held.downloads+'/save.bin'),{flag:'wx'});
    fs.rmSync(held.root,{recursive:true});
  }finally{fs.rmSync(out,{recursive:true});}
});

test('whole XWD conversion preserves exact previous PNG and all pixels without raw disk writes',async()=>{
  const out=fs.mkdtempSync('/dev/shm/wine-capture-test-');let display;
  try{
    display=await require('../tools/gltron-headful-display.cjs').start(out);
    const b=cp.execFileSync('xwd',['-root','-silent'],{env:display.env,timeout:3000,maxBuffer:16*1024*1024});
    // Independent previous conversion, including stride, byte order and PNG options.
    const {PNG}=require('pngjs'),width=b.readUInt32BE(16),height=b.readUInt32BE(20),old=new PNG({width,height});
    const start=b.readUInt32BE(0)+12*b.readUInt32BE(76),stride=b.readUInt32BE(48);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=start+y*stride+x*4,v=b.readUInt32BE(28)===0?b.readUInt32LE(i):b.readUInt32BE(i),j=(y*width+x)*4;
      old.data[j]=(v>>16)&255;old.data[j+1]=(v>>8)&255;old.data[j+2]=v&255;old.data[j+3]=255;
    }
    const encoded=encodeXwd(b);assert.deepEqual(encoded.png,PNG.sync.write(old,{deflateLevel:1,filterType:0}));
    assert.deepEqual(PNG.sync.read(encoded.png).data,old.data);
    const metadata=captureWhole(out,'whole',display.env);assert.equal(metadata.rawStorage,'memory');
    assert.equal(fs.readdirSync(out).filter(n=>n.endsWith('.xwd')).length,0);
    assert.deepEqual(PNG.sync.read(fs.readFileSync(out+'/whole.png')).data,old.data);
    console.log(JSON.stringify({exactWholePNG:true,exactPixels:true,metadata}));
  }finally{if(display)await display.close();fs.rmSync(out,{recursive:true});}
});

test('actual Chrome writes measurable profile/cache/temp on tmpfs and drains before cleanup',{timeout:45000},async()=>{
  const w=create();let child,joined,watchdog,watchWait,ws,monitor,minimum=free(),low=false;
  const payload=Buffer.alloc(16384,65),server=http.createServer((req,res)=>{
    res.writeHead(200,{'Content-Type':req.url==='/cache'?'text/plain':'text/html','Cache-Control':'public,max-age=3600'});
    res.end(req.url==='/cache'?payload:'<body style="background:#123456"><script>fetch("/cache").then(r=>r.text()).then(t=>document.title="cached-"+t.length)</script>');
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    assert(minimum>1500000000);
    child=cp.spawn('/usr/bin/google-chrome',[...require('../tools/browser-component-update-args.cjs'),...w.args,
      '--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-background-networking',
      '--disable-dev-shm-usage','--remote-debugging-port=0','http://127.0.0.1:'+server.address().port],
      {env:w.env(),detached:true,stdio:['ignore','pipe','pipe']});
    joined=w.watch(child);child.stdout.resume();child.stderr.resume();
    watchdog=cp.spawn(process.execPath,['-e',`const pid=+process.argv[1];const kill=()=>{try{process.kill(-pid,'SIGKILL')}catch{}};const t=setTimeout(()=>{kill();process.exit(1)},35000);process.stdin.once('data',()=>{clearTimeout(t);process.exit(0)});process.stdin.once('end',()=>{kill();process.exit(1)});`,String(child.pid)],{stdio:['pipe','pipe','pipe']});
    watchdog.stdout.resume();watchdog.stderr.resume();watchWait=new Promise(r=>watchdog.once('close',(code,signal)=>r({code,signal,stdoutEOF:watchdog.stdout.readableEnded,stderrEOF:watchdog.stderr.readableEnded})));
    monitor=setInterval(()=>{minimum=Math.min(minimum,free());if(minimum<=1530000000){low=true;try{process.kill(-child.pid,'SIGTERM')}catch{}}},25);
    const active=w.profile+'/DevToolsActivePort',end=Date.now()+15000;
    while(!fs.existsSync(active)&&Date.now()<end&&!low)await sleep(20);
    assert(!low,'global disk reserve preempted fixture');assert(fs.existsSync(active));
    const [port,endpoint]=fs.readFileSync(active,'utf8').trim().split('\n');ws=new WebSocket('ws://127.0.0.1:'+port+endpoint);
    await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
    let id=0;const pending=new Map();ws.onmessage=e=>{const v=JSON.parse(e.data),p=pending.get(v.id);if(p){clearTimeout(p.timer);pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}};
    const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('UNKNOWN '+method));},3000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
    await sleep(1500);
    const tabs=(await send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(tabs.length,1);
    const session=(await send('Target.attachToTarget',{targetId:tabs[0].targetId,flatten:false})).sessionId;
    // A direct page websocket keeps the capture request on the actual page.
    const pages=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json(),page=new WebSocket(pages.find(p=>p.id===tabs[0].targetId).webSocketDebuggerUrl);
    await new Promise((r,j)=>{page.onopen=r;page.onerror=j;});
    const shot=await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('UNKNOWN capture')),3000);page.onmessage=e=>{const v=JSON.parse(e.data);if(v.id===1){clearTimeout(t);v.error?j(Error(JSON.stringify(v.error))):r(v.result);}};page.send(JSON.stringify({id:1,method:'Page.captureScreenshot',params:{format:'png',captureBeyondViewport:false}}));});page.close();
    const png=Buffer.from(shot.data,'base64');assert.equal(png.subarray(1,4).toString(),'PNG');fs.writeFileSync(w.tmp+'/whole.png',png,{flag:'wx'});
    await send('Target.detachFromTarget',{sessionId:session});
    const measures={profile:allocated(w.profile),cache:allocated(w.cache),tmp:allocated(w.tmp),rootDev:fs.statSync('/home').dev,tmpfsDev:fs.statSync(w.root).dev};
    assert(measures.profile>16384);assert(measures.cache>16384);assert(measures.tmp>0);assert.notEqual(measures.rootDev,measures.tmpfsDev);
    for(const d of [w.profile,w.cache,w.tmp])assert.equal(fs.statfsSync(d).type,0x01021994);
    const temporaryPaths=fs.readdirSync(w.tmp);console.log(JSON.stringify({measures,temporaryPaths,envTmp:fs.readFileSync('/proc/'+child.pid+'/environ').toString().split('\0').filter(v=>/^(TMP|TEMP|XDG_CACHE_HOME)/.test(v))}));assert(temporaryPaths.length>0,'Chrome actually uses private TMPDIR');
    await send('Browser.close');
    const timer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL')}catch{}},5000);
    const receipt=await joined;clearTimeout(timer);ws.close();
    watchdog.stdin.write('done');const watchReceipt=await watchWait;
    assert.equal(receipt.code,0);assert(receipt.stdoutEOF&&receipt.stderrEOF);assert.equal(watchReceipt.code,0);
    assert(!low);const cleanup=await w.cleanup();assert(cleanup.removed);
    console.log(JSON.stringify({actualChrome:true,measures,minimumHomeFree:minimum,receipt,watchReceipt,cleanup}));
  }finally{
    if(child&&child.exitCode===null&&child.signalCode===null)try{process.kill(-child.pid,'SIGKILL')}catch{}
    if(joined)await joined;
    if(watchdog&&watchdog.exitCode===null)watchdog.stdin.write('done');if(watchWait)await watchWait;
    ws?.close();clearInterval(monitor);server.closeAllConnections();await new Promise(r=>server.close(r));await w.cleanup();
    assert(free()>1500000000);
  }
});
