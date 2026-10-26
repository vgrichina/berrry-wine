'use strict';
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const puppeteer=require('/tmp/wa-local-runtime-deps/node_modules/puppeteer-core');
const P='/tmp/dashboard-sidebar-private-browser-activation-oct26';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const save=(n,x)=>fs.writeFileSync(`${P}/${n}`,JSON.stringify(x,null,2)+'\n');
let browser,timer;
(async()=>{
 const start=Date.now();let stateRequests=0,blockedRequests=0,pageErrors=0,appLoaded=null;
 browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,userDataDir:`${P}/browser-profile`,timeout:15000,protocolTimeout:15000,args:['--no-sandbox','--disable-dev-shm-usage','--disk-cache-size=1048576','--media-cache-size=1048576','--disable-application-cache','--disable-gpu','--renderer-process-limit=2','--disable-background-networking','--no-first-run','--disable-default-apps','--disable-extensions','--disable-sync']});
 save('browser-startup.json',{argv:browser.process().spawnargs,pid:browser.process().pid,nodeArgv:process.execArgv,nodeExecutable:process.execPath,NODE_OPTIONS:process.env.NODE_OPTIONS,nodeLimits:fs.readFileSync('/proc/self/limits','utf8'),version:await browser.version(),startedAt:new Date(start).toISOString(),deadlineSeconds:60,installedDriver:'/tmp/wa-local-runtime-deps/node_modules/puppeteer-core',launchConfigurationReused:'/tmp/blocker-count-private-dashboard-activation-oct26/browser.cjs'});
 timer=setTimeout(()=>{browser.process().kill('SIGKILL');process.exitCode=2;},55000);
 const page=await browser.newPage();await page.setViewport({width:1400,height:900,deviceScaleFactor:1});
 await page.setCacheEnabled(false);await page.setRequestInterception(true);
 page.on('request',r=>{
  const u=new URL(r.url());
  if(u.origin!=='http://127.0.0.1:8098'||r.method()!=='GET'){blockedRequests++;return r.abort();}
  if(u.pathname==='/api/state'&&++stateRequests>1){blockedRequests++;return r.abort();}
  if(u.pathname.startsWith('/api/')&&u.pathname!=='/api/state'){blockedRequests++;return r.abort();}
  r.continue();
 });
 const appPromise=new Promise(resolve=>page.on('response',async r=>{if(new URL(r.url()).pathname==='/app.js'){const b=await r.buffer();resolve({status:r.status(),bytes:b.length,sha256:hash(b),fromCache:r.fromCache()});}}));
 page.on('pageerror',()=>pageErrors++);
 await page.evaluateOnNewDocument(()=>{
  const original=window.fetch.bind(window),interval=window.setInterval.bind(window);
  window.setInterval=(fn,ms,...args)=>ms===5000?0:interval(fn,ms,...args);
  window.fetch=async(...args)=>{
   const r=await original(...args);if(new URL(args[0],location.href).pathname!=='/api/state')return r;
   const limit=24*1024*1024,declared=r.headers.get('content-length');
   if(declared&&Number(declared)>limit){await r.body.cancel();throw Error('private state declared size cap before parsing');}
   const reader=r.body.getReader(),chunks=[];let n=0;
   for(;;){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>limit){await reader.cancel();throw Error('private state streaming cap before parsing');}chunks.push(value);}
   window.__stateBytes=n;window.__stateHTTP=r.status;
   const blob=new Blob(chunks);window.__stateSHA256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
   return new Response(blob,{status:r.status,headers:r.headers});
  };
 });
 const response=await page.goto('http://127.0.0.1:8098/#blockers',{waitUntil:'domcontentloaded',timeout:20000});
 appLoaded=await appPromise;
 assert.equal(appLoaded.sha256,'81fd237e43112d93f946ed327e3d4e9cdd57ed1f7fc0642d2583e0b3e8693059');assert.equal(appLoaded.status,200);
 await page.waitForFunction(()=>typeof state!=='undefined'&&state&&document.querySelector('#main .lead')?.textContent.includes('distinct blocked task IDs'),{timeout:25000});
 const result=await page.evaluate(()=>{
  const rows=state.tasks.filter(t=>t.status==='blocked'),identified=rows.filter(t=>t.id!=null&&String(t.id).trim()!==''),ids=new Set(identified.map(t=>t.id));
  const counts={distinctBlockedTaskIds:ids.size,rawBlockedRows:rows.length,duplicateBlockedRows:identified.length-ids.size,anonymousBlockedRows:rows.length-identified.length};
  const sidebar=document.querySelector('#blocker-count'),label=document.querySelector('#main .lead').textContent;
  const classifications=document.querySelector('#main .title-row + p.source-note').textContent;
  const roots=BlockerModel.primaryRoots(state,BlockerModel.order(state,rows)),split=BlockerModel.split(state,roots);
  const approvals=(state.approvals?.items||[]).filter(p=>!p.sent).length;
  const expectedClassification=`${approvals} live approvals · ${split.user.length} need your input · ${split.agent.length} agent-resolvable · ${rows.length-roots.length} dependent rows (filtered row classifications; not current eligibility).`;
  const expectedSidebar=rows.length?`${ids.size} distinct IDs${counts.anonymousBlockedRows?` + ${counts.anonymousBlockedRows} anonymous rows`:''}`:'';
  const a=document.querySelector('#main .title-row').getBoundingClientRect(),b=document.querySelector('#main .title-row + p.source-note').getBoundingClientRect();
  return {counts,label,classifications,sidebar:sidebar.textContent,sidebarTitle:sidebar.title,sidebarMatchesIndependent:sidebar.textContent===expectedSidebar,sidebarTitleMatches:sidebar.title===BlockerModel.countSummaryText(counts),detailMatchesIndependent:label===BlockerModel.countSummaryText(counts),rowClassificationsPreserved:classifications===expectedClassification,renderedClassifiedRows:document.querySelectorAll('#main .blocker-list .blocker:not(.blocker-action)').length,expectedRootRows:roots.length,duplicateRowsNotExtraTasks:counts.rawBlockedRows-counts.anonymousBlockedRows-counts.duplicateBlockedRows===counts.distinctBlockedTaskIds,repeatedHeading:[...document.querySelectorAll('#main h2')].some(x=>x.textContent.includes('Repeated task IDs')),apiHTTP:window.__stateHTTP,apiBytes:window.__stateBytes,apiSHA256:window.__stateSHA256,clip:{x:Math.floor(a.x),y:Math.floor(a.y),width:Math.ceil(a.width),height:Math.ceil(b.bottom-a.y)}};
 });
 result.htmlHTTP=response.status();result.appLoaded=appLoaded;
 const detailShot=await page.screenshot({type:'png',clip:result.clip});assert.ok(detailShot.length<=2097152);fs.writeFileSync(`${P}/detail-counts-redacted.png`,detailShot);
 const side=await page.$('a[data-view="blockers"]');const sidebarShot=await side.screenshot({type:'png'});assert.ok(sidebarShot.length<=2097152);fs.writeFileSync(`${P}/sidebar-count-redacted.png`,sidebarShot);
 await page.click('a[data-view="overview"]');await page.waitForFunction(()=>document.body.dataset.view==='overview');
 result.overview=await page.evaluate(()=>({stats:[...document.querySelectorAll('#main .stats .stat')].map(e=>({label:e.querySelector('.sub')?.textContent,value:Number(e.querySelector('.value')?.textContent)})),expected:['active','ready','blocked','review'].map(s=>state.tasks.filter(t=>t.status===s).length),sidebar:document.querySelector('#blocker-count').textContent}));
 result.overviewRawRowStatsPreserved=result.overview.stats.length===4&&result.overview.stats.every((x,i)=>x.value===result.overview.expected[i]);
 await page.click('a[data-view="blockers"]');await page.waitForFunction(()=>document.body.dataset.view==='blockers');
 result.routeReturnConsistent=await page.evaluate((r)=>document.querySelector('#blocker-count').textContent===r.sidebar&&document.querySelector('#main .lead').textContent===r.label,result);
 result.stateRequests=stateRequests;result.blockedRequests=blockedRequests;result.pageErrors=pageErrors;result.elapsedSeconds=(Date.now()-start)/1000;
 result.screenshotBytes={detail:detailShot.length,sidebar:sidebarShot.length};
 result.scope='Actual deployed app and one fresh real private API snapshot; only aggregate labels/counts and state hash exported. Cache and periodic refresh disabled for bounded check; no state mutation.';
 result.screenshotRedaction='Cropped aggregate summary/classification only and Blockers navigation element only; no private task contents or IDs exported.';
 result.pass=result.htmlHTTP===200&&result.apiHTTP===200&&result.sidebarMatchesIndependent&&result.sidebarTitleMatches&&result.detailMatchesIndependent&&result.rowClassificationsPreserved&&result.renderedClassifiedRows===result.expectedRootRows&&result.duplicateRowsNotExtraTasks&&result.overviewRawRowStatsPreserved&&result.routeReturnConsistent&&stateRequests===1&&pageErrors===0;
 save('browser-result.json',result);console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
})().catch(e=>{save('browser-error.json',{error:String(e)});console.error(String(e));process.exitCode=1;}).finally(async()=>{if(timer)clearTimeout(timer);if(browser)await browser.close();});
