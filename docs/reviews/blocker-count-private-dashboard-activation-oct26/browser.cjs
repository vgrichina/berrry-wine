const fs=require('fs');
const puppeteer=require('/tmp/wa-local-runtime-deps/node_modules/puppeteer-core');
const P='/tmp/blocker-count-private-dashboard-activation-oct26';
const save=(n,x)=>fs.writeFileSync(`${P}/${n}`,JSON.stringify(x,null,2)+'\n');
let browser,timer;
(async()=>{
 const start=Date.now();let stateRequests=0,blockedRequests=0;
 browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,userDataDir:`${P}/browser-profile`,timeout:15000,protocolTimeout:15000,args:['--no-sandbox','--disable-dev-shm-usage','--disk-cache-size=1048576','--media-cache-size=1048576','--disable-application-cache','--disable-gpu','--renderer-process-limit=2','--disable-background-networking','--no-first-run','--disable-default-apps','--disable-extensions','--disable-sync']});
 save('browser-startup.json',{argv:browser.process().spawnargs,pid:browser.process().pid,nodeArgv:process.execArgv,nodeLimits:fs.readFileSync('/proc/self/limits','utf8'),version:await browser.version(),startedAt:new Date(start).toISOString(),deadlineSeconds:60});
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
 let pageErrors=0;page.on('pageerror',()=>pageErrors++);
 await page.evaluateOnNewDocument(()=>{
  const original=window.fetch.bind(window);window.__stateBytes=0;
  const interval=window.setInterval.bind(window);
  window.setInterval=(fn,ms,...args)=>{if(ms===5000)return 0;return interval(fn,ms,...args);};
  window.fetch=async(...args)=>{
   const r=await original(...args);
   if(new URL(args[0],location.href).pathname!=='/api/state')return r;
   const reader=r.body.getReader(),chunks=[];let n=0;
   for(;;){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>24*1024*1024){await reader.cancel();throw Error('private state byte cap before parsing');}chunks.push(value);}
   window.__stateBytes=n;window.__stateHTTP=r.status;
   return new Response(new Blob(chunks),{status:r.status,headers:r.headers});
  };
 });
 const response=await page.goto('http://127.0.0.1:8098/#blockers',{waitUntil:'domcontentloaded',timeout:20000});
 await page.waitForFunction(()=>typeof state!=='undefined'&&state&&document.querySelector('#main .lead')?.textContent.includes('distinct blocked task IDs'),{timeout:25000});
 const result=await page.evaluate(()=>{
  const rows=state.tasks.filter(t=>t.status==='blocked');
  const identified=rows.filter(t=>t.id!=null&&String(t.id).trim()!=='');
  const ids=new Set(identified.map(t=>t.id));
  const counts={distinctBlockedTaskIds:ids.size,rawBlockedRows:rows.length,duplicateBlockedRows:identified.length-ids.size,anonymousBlockedRows:rows.length-identified.length};
  const label=document.querySelector('#main .lead').textContent;
  const classifications=document.querySelector('#main .title-row + p.source-note').textContent;
  const repeatedHeading=[...document.querySelectorAll('#main h2')].map(x=>x.textContent).find(x=>x.includes('Repeated task IDs'))||null;
  const sidebar=document.querySelector('#blocker-count').textContent;
  const a=document.querySelector('#main .title-row').getBoundingClientRect();
  const b=document.querySelector('#main .title-row + p.source-note').getBoundingClientRect();
  return {counts,label,classifications,repeatedHeading,sidebarRawRowCount:Number(sidebar),apiHTTP:window.__stateHTTP,apiBytes:window.__stateBytes,displayMatchesIndependentCounts:label===BlockerModel.countSummaryText(counts),duplicatesDoNotIncreaseDistinctCount:counts.rawBlockedRows-counts.anonymousBlockedRows-counts.duplicateBlockedRows===counts.distinctBlockedTaskIds,rowsLabeled:classifications.includes('dependent rows')&&classifications.includes('filtered row classifications'),clip:{x:Math.floor(a.x),y:Math.floor(a.y),width:Math.ceil(a.width),height:Math.ceil(b.bottom-a.y)}};
 });
 result.htmlHTTP=response.status();result.stateRequests=stateRequests;result.blockedRequests=blockedRequests;result.pageErrors=pageErrors;result.elapsedSeconds=(Date.now()-start)/1000;
 result.scope='Unmodified deployed page, real current private API state; no task contents exported; fresh owned profile, cache disabled, refresh disabled for one bounded snapshot';
 const shot=await page.screenshot({type:'png',clip:result.clip});
 if(shot.length>2*1024*1024)throw Error('screenshot exceeds capture cap');
 fs.writeFileSync(`${P}/counts-focused-redacted.png`,shot);result.screenshotBytes=shot.length;
 result.screenshotRedaction='Only aggregate summary and row classification labels captured by crop; all private task/detail/agent/sidebar content outside clip';
 result.pass=result.htmlHTTP===200&&result.apiHTTP===200&&result.displayMatchesIndependentCounts&&result.duplicatesDoNotIncreaseDistinctCount&&result.rowsLabeled&&result.counts.duplicateBlockedRows>0;
 save('browser-result.json',result);
 console.log(JSON.stringify(result));
 if(!result.pass)process.exitCode=1;
})().catch(e=>{save('browser-error.json',{error:String(e)});console.error(String(e));process.exitCode=1;}).finally(async()=>{if(timer)clearTimeout(timer);if(browser)await browser.close();});
