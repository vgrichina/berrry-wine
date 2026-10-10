'use strict';
// Source/JS-only preparation. Reuse the immutable accepted archive by hardlink;
// no boat invocation, browser, guest execution, build or fixture duplication.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto'), zlib = require('zlib');
const probe = require('./antara-win16-callback');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function tarFiles(bytes) {
  const files = new Map(); let longName = null;
  for (let at = 0; at + 512 <= bytes.length;) {
    const header = bytes.subarray(at, at + 512); if (header.every(v => v === 0)) break;
    const str = (off, n) => header.subarray(off, off + n).toString().split('\0')[0];
    const size = parseInt(str(124,12).trim() || '0',8); if (!Number.isSafeInteger(size) || size < 0 || at + 512 + size > bytes.length) throw Error('tar bounds');
    const body = bytes.subarray(at + 512, at + 512 + size), type = str(156,1);
    if(type === 'L') longName = body.toString().split('\0')[0];
    else {const name = longName || (str(345,155) ? str(345,155) + '/' : '') + str(0,100); longName = null; if(type === '0' || type === '') {if(files.has(name))throw Error('duplicate tar member');files.set(name,body);} else if(type !== '5') throw Error('unsupported archive entry '+type);}
    at += 512 + Math.ceil(size/512)*512;
  }
  return files;
}
function prepare(output, baseline, prefix) {
  output = path.resolve(output); baseline = path.resolve(baseline);
  if(typeof prefix !== 'string' || !/^\/home\/user\/antara-install-[a-z0-9-]+$/.test(prefix))throw Error('fresh scoped Antara Install prefix required');
  if(fs.existsSync(output))throw Error('fresh output directory required');
  const archivePath = baseline+'/runtime-package.tar.gz', archive = fs.readFileSync(archivePath);
  if(sha(archive)!=='8007a9b5a3f1fb05a9ef8b861994ffeb936fdd1542688e2241c591d878420031')throw Error('accepted archive identity');
  const members = tarFiles(zlib.gunzipSync(archive)), oldPrefix = '/home/user/antara-client-origin-20261008';
  const pins = JSON.parse(fs.readFileSync(baseline+'/runtime-pins.json'));
  function member(rel) {const b = members.get(path.basename(oldPrefix)+'/'+rel); if(!b)throw Error('missing archive member '+rel);return b;}
  for(const p of pins) {const b=member(p.remote.slice(oldPrefix.length+1));if(b.length!==p.bytes||sha(b)!==p.sha256)throw Error('baseline member drift '+p.remote);}
  if(pins.length!==503||members.size!==503)throw Error('baseline closure count');
  fs.mkdirSync(output,{recursive:true}); fs.linkSync(archivePath,output+'/payload.tar.gz');
  const changes = new Map(), helper = fs.readFileSync(require.resolve('./antara-win16-callback'),'utf8');
  changes.set('callback-worker.js',Buffer.from(probe.overlay(member('source/lib/guest-worker.js').toString(),helper)));
  changes.set('callback-link.js',Buffer.from(probe.linkOverlay(member('source/lib/guest-thread-host.js').toString())));
  const plan=JSON.parse(member('browser-pins9.json'));
  const rewrite=s=>s.replaceAll(oldPrefix,prefix);
  for(const n of ['browser9.js','assets.js','cleanup.js','collector.js','context.js','pointer-snapshot.js','ordinary-combined-plan.json','registration.json','apps.js'])changes.set(n,Buffer.from(rewrite(member(n).toString())));
  let driver=changes.get('browser9.js').toString();
  const anchor='return{pointer:'; if(driver.split(anchor).length!==2)throw Error('driver state anchor');
  driver=driver.replace(anchor,'return{callbacks:[w?.guestWorker?.link,...Array.from(w?.threadManager?.threads||[]).slice(0,1).map(([h,t])=>t.link)].filter(Boolean).map(l=>({slot:l.slot,receipt:l.antaraWin16Receipt||null})),pointer:');
  driver=driver.replace("'use strict';", "'use strict';\nconst activateExisting="+probe.activateExisting.toString()+";");
  const press='try{await page.mouse.move(c.x,c.y);await page.mouse.down();';
  if(driver.split(press).length!==2)throw Error('ordinary press anchor');
  driver=driver.replace(press,"try{row.activationToken='antara-'+Date.now();row.hoverAcks=await page.evaluate(activateExisting,await page.evaluateHandle(()=>runningApps.find(a=>a.name==='antara_demo_setup')?.wine),row.activationToken,'hover');await page.mouse.move(c.x,c.y,{steps:4});await new Promise(resolve=>setTimeout(resolve,150));row.hoverBeforeDown={ordinaryDOMMove:true,steps:4,settleMs:150};row.downAcks=await page.evaluate(activateExisting,await page.evaluateHandle(()=>runningApps.find(a=>a.name==='antara_demo_setup')?.wine),row.activationToken,'down');await page.mouse.down();");
  const release='try{await page.mouse.up();';
  if(driver.split(release).length!==2)throw Error('ordinary release anchor');
  driver=driver.replace(release,"try{if(row.downAcks){try{row.upAcks=await page.evaluate(activateExisting,await page.evaluateHandle(()=>runningApps.find(a=>a.name==='antara_demo_setup')?.wine),row.activationToken,'up');}catch(e){row.upActivationError=String(e);}await page.mouse.up();");
  const releaseEnd="document));}catch(e){if(!primary)primary=e;else primary.releaseError=String(e);}";
  if(driver.split(releaseEnd).length!==2)throw Error('ordinary release end anchor');
  driver=driver.replace(releaseEnd,releaseEnd.replace('}catch','}}catch'));
  driver=driver.replace('m.text().slice(0,1600)',"m.text().slice(0,m.text().includes('ANTARA_FINAL ')?65536:1600)");
  const chromeAnchor="  browser=await require('puppeteer').launch";
  if(driver.split(chromeAnchor).length!==2)throw Error('Chrome preflight anchor');
  driver=driver.replace(chromeAnchor,`  const checkedHttp={at:new Date().toISOString(),heads:0,gets:[]};const base='http://127.0.0.1:'+server.address().port+'/';
  for(const rel of [...Object.keys(plan.sourceHashes),...plan.fixtures.map(f=>f.path),...Object.keys(plan.aliases)]){const r=await fetch(base+rel,{method:'HEAD'});if(r.status!==200)throw Error('HTTP HEAD '+rel);checkedHttp.heads++;}
  for(const rel of ['build/wine-assembly.wasm','lib/guest-worker.js','lib/guest-thread-host.js',plan.criticalFiles.find(f=>/\\/SETUP\\.EXE$/i.test(f.path)).path]){const r=await fetch(base+rel),b=Buffer.from(await r.arrayBuffer()),expected=plan.sourceHashes[rel]||plan.criticalFiles.find(f=>f.path===rel).sha256;if(r.status!==200||sha(b)!==expected)throw Error('HTTP SHA '+rel);checkedHttp.gets.push({path:rel,sha256:sha(b)});}save('checked-http.json',checkedHttp);
${chromeAnchor}`);
  changes.set('browser9.js',Buffer.from(driver));
  for(const key of ['sourceRoot','fixtureRoot'])plan[key]=rewrite(plan[key]);
  for(const key of Object.keys(plan.sourceOverrides))plan.sourceOverrides[key]=rewrite(plan.sourceOverrides[key]);
  plan.optionalNegativeProbes=plan.optionalNegativeProbes.map(p=>({...p,root:rewrite(p.root)}));
  plan.sourceOverrides['lib/guest-worker.js']=prefix+'/callback-worker.js';
  plan.sourceOverrides['lib/guest-thread-host.js']=prefix+'/callback-link.js';
  plan.sourceHashes['lib/guest-worker.js']=sha(changes.get('callback-worker.js'));
  plan.sourceHashes['lib/guest-thread-host.js']=sha(changes.get('callback-link.js'));
  plan.buildProvenance='Accepted f62ab3c9f/module4dc5ac2c original 503-pin runtime plus two explicitly pinned private JS observer overlays. Existing set_win16_trace flag only; no guest/control/CPU writes. No current-main build qualification.';
  changes.set('browser-pins9.json',Buffer.from(JSON.stringify(plan,null,2)));
  for(const [n,b]of changes){fs.writeFileSync(output+'/'+n,b);if(n.endsWith('.js'))cp.execFileSync(process.execPath,['--check',output+'/'+n]);}
  const finalPins=pins.map(p=>{const rel=p.remote.slice(oldPrefix.length+1),b=changes.get(rel);return {...p,remote:prefix+'/'+rel,...(b?{bytes:b.length,sha256:sha(b)}:{})};});
  for(const n of ['callback-worker.js','callback-link.js']){const b=changes.get(n);finalPins.push({local:output+'/'+n,remote:prefix+'/'+n,bytes:b.length,sha256:sha(b)});}
  fs.writeFileSync(output+'/transfer-files.json',JSON.stringify(finalPins,null,2));
  fs.writeFileSync(output+'/overlay-files.json',JSON.stringify([...changes.keys()],null,2));
  const originalPreparation=path.dirname(baseline)+'/20261008-antara-client-origin-fix';
  for(const n of ['authorization.js','transport.js','control.js','transfer.js','upload-batches.js']){
    let text=rewrite(fs.readFileSync(originalPreparation+'/'+n,'utf8'));
    if(n==='transfer.js'){
      text=text.replace("'use strict';", "'use strict';\nprocess.env.ANTARA_TRANSFER_DEADLINE=String(Date.now()+240000);");
      text=text.replace("const child=cp.spawn(","if(Date.now()>=Number(process.env.ANTARA_TRANSFER_DEADLINE))throw Error('transfer240sec deadline');const child=cp.spawn(");
      text=text.replace('},10000);','},Math.max(1,Math.min(10000,Number(process.env.ANTARA_TRANSFER_DEADLINE)-Date.now())));');
      const unpack='cp.execFileSync("tar",["xzf",${JSON.stringify(p)},"-C","/home/user"]);';
      if(text.split(unpack).length!==2)throw Error('transfer unpack anchor');
      text=text.replace(unpack,'fs.mkdirSync(${JSON.stringify(prefix)});cp.execFileSync("tar",["xzf",${JSON.stringify(p)},"--strip-components=1","-C",${JSON.stringify(prefix)}]);');
      const anchor='  const manifest=Buffer.from'; if(text.split(anchor).length!==2)throw Error('transfer overlay anchor');
      text=text.replace(anchor,'  for(const name of JSON.parse(fs.readFileSync(dir+"/overlay-files.json"))){const b=fs.readFileSync(dir+"/"+name);for(let off=0;off<b.length;off+=90000)put(prefix+"/"+name,b.subarray(off,off+90000),off,b.length);}\n'+anchor);
    }
    if(n==='transport.js') {
      text=text.replace("function remote(script){", "function remote(script){require('./authorization')();if(process.env.ANTARA_TRANSFER_DEADLINE&&Date.now()>=Number(process.env.ANTARA_TRANSFER_DEADLINE))throw Error('transfer240sec deadline');");
      text=text.replace('function put(p,b,offset,total){',"function put(p,b,offset,total){require('./authorization')();if(process.env.ANTARA_TRANSFER_DEADLINE&&Date.now()>=Number(process.env.ANTARA_TRANSFER_DEADLINE))throw Error('transfer240sec deadline');");
      text=text.replaceAll("{encoding:'utf8',maxBuffer:5e6}","{encoding:'utf8',maxBuffer:5e6,timeout:Math.max(1,Math.min(10000,Number(process.env.ANTARA_TRANSFER_DEADLINE||Date.now()+10000)-Date.now()))}");
    }
    if(n==='authorization.js') text=text.replace('!r.basis||', '!r.basis||!/^\\/home\\/user\\/[a-zA-Z0-9/_-]+\\/node_modules$/.test(r.puppeteerNodePath||"")||');
    if(n==='control.js') text=text.replace('NODE_PATH:"/home/user/q2-tools-20261008/node_modules"','NODE_PATH:${JSON.stringify(require("./authorization")().puppeteerNodePath)}');
    fs.writeFileSync(output+'/'+n,text);cp.execFileSync(process.execPath,['--check',output+'/'+n]);
  }
  fs.copyFileSync(require.resolve('./antara-win16-callback'),output+'/observer-source.js');
  const ready={at:new Date().toISOString(),status:'SOURCE/JS READY ONLY; requires next-phase root review and queued slot after Tiberian/Warcraft actual releases; no remote/native/browser performed',referenceSource:plan.builtSourceCommit,module:plan.sourceHashes['build/wine-assembly.wasm'],baselineArchive:sha(archive),baselinePins:pins.length,finalPins:finalPins.length,originalMedia:plan.criticalFiles.length,overlays:Object.fromEntries(['callback-worker.js','callback-link.js'].map(n=>[n,sha(changes.get(n))])),observer:sha(Buffer.from(helper)),remotePrefix:prefix,traceFlag:'Existing set_win16_trace explicit acknowledgment before ordinary hover, DOWN/UP across exactly two existing Workers; no mailbox/CPU/guest/control writes',bounds:{workers:2,rowsPerWorker:128,memoryBytesPerWorker:32768,phaseQuotas:{hover:{rows:32,bytes:8192,words:32768,cpuMs:50},down:{rows:32,bytes:8192,words:32768,cpuMs:50},up:{rows:64,bytes:16384,words:65536,cpuMs:100}},deadlineMs:8000,downAndUpReservedSeparately:true,transferMs:240000,browserMs:120000,cleanupReserveMs:90000},sourceCause:'unmeasured; route/API evidence requires original-code authentication; no production correction justified',gameplay:false};
  ready.bounds.phaseQuotas.up.bytes=14336;ready.bounds.trap={bytes:2048,rows:0,deadline:'same absolute 8s',once:true};
  fs.writeFileSync(output+'/READY.json',JSON.stringify(ready,null,2));return ready;
}
if(require.main===module){try{console.log(JSON.stringify(prepare(process.argv[2],process.argv[3],process.argv[4]),null,2));}catch(e){console.error(e);process.exitCode=1;}}
module.exports={prepare,tarFiles};
