'use strict';
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
const root='/home/user/madbomber-browser',repo=root+'/repo',out=root+'/evidence/browser2';fs.mkdirSync(out+'/commands',{recursive:true});
const puppeteer=require(repo+'/node_modules/puppeteer');
const pause=ms=>new Promise(r=>setTimeout(r,ms)),save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2));
let browser,page,server,closed=false;const events=[],errors=[],network=[],inputs=[],moduleResponses=[];const started=Date.now();
async function shot(name){await page.screenshot({path:out+'/'+name+'.png'});save(name+'.json',await page.evaluate(()=>({url:location.href,at:new Date().toISOString(),text:document.body.innerText.slice(-10000),canvas:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height,rect:JSON.parse(JSON.stringify(c.getBoundingClientRect()))})),log:document.getElementById('log')?.textContent?.slice(-15000)})));console.log('shot',name);}
async function close(reason){if(closed)return;closed=true;save('console.json',events);save('errors.json',errors);save('network.json',network);save('inputs.json',inputs);save('module-responses.json',moduleResponses);await browser?.close();server?.kill('SIGTERM');save('cleanup.json',{at:new Date().toISOString(),reason,elapsedMs:Date.now()-started,serverPid:server?.pid});}
process.on('SIGTERM',()=>close('SIGTERM'));
(async()=>{
server=cp.spawn('node',['tools/dev-server.js','--port=8080','--isolate','--no-agent-inject'],{cwd:repo,stdio:['ignore',fs.openSync(out+'/server.log','a'),fs.openSync(out+'/server.log','a')]});await pause(700);
browser=await puppeteer.launch({headless:false,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding'],env:{...process.env,DISPLAY:':0'},protocolTimeout:15000,timeout:30000});
page=await browser.newPage();await page.setViewport({width:1000,height:760});
page.on('console',m=>{if(events.length<2000)events.push({at:new Date().toISOString(),type:m.type(),text:m.text().slice(0,2000)})});page.on('pageerror',e=>errors.push({at:new Date().toISOString(),error:String(e)}));
page.on('requestfailed',r=>network.push({at:new Date().toISOString(),url:r.url(),failure:r.failure()}));
page.on('response',async r=>{network.push({at:new Date().toISOString(),url:r.url(),status:r.status()});if(/\.wasm(?:\?|$)/.test(r.url())){try{const b=await r.buffer();moduleResponses.push({url:r.url(),bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}catch(e){errors.push({moduleCapture:String(e)})}}});
await page.goto('http://127.0.0.1:8080/index.html?app=madbomber&debug',{waitUntil:'load',timeout:45000});
save('identity.json',{revision:'0c0fa3ebd7a84b6254a160c6cdfa6774c556d4cb',browser:await browser.version(),node:process.version,route:page.url(),startedAt:new Date(started).toISOString(),pid:process.pid,chromePid:browser.process().pid,serverPid:server.pid,viewport:{width:1000,height:760}});
await pause(12000);await shot('startup');let n=0;
while(!closed&&Date.now()-started<480000){const f=out+'/commands/'+n+'.json';if(fs.existsSync(f)){const c=JSON.parse(fs.readFileSync(f));n++;try{
 if(c.action==='shot')await shot(c.name);
 else if(c.action==='key'){if(!['Enter','Space','Escape'].includes(c.key))throw Error('key forbidden');inputs.push({at:new Date().toISOString(),...c});await page.keyboard.down(c.key);await pause(100);await page.keyboard.up(c.key);await pause(c.settleMs||300);await shot(c.name);}
 else if(c.action==='mouse'){inputs.push({at:new Date().toISOString(),...c});await page.mouse.move(c.x,c.y);await pause(c.settleMs||300);await shot(c.name);}
 else if(c.action==='click'){inputs.push({at:new Date().toISOString(),...c});await page.mouse.click(c.x,c.y);await pause(c.settleMs||500);await shot(c.name);}
 else if(c.action==='window'){const t=Date.now();save('window-start.json',{at:new Date().toISOString(),limitMs:60000});for(const a of c.actions){await pause(Math.max(0,a.ms-(Date.now()-t)));if(a.ms>59000)throw Error('window bound');inputs.push({at:new Date().toISOString(),elapsedMs:Date.now()-t,...a});if(a.key){await page.keyboard.down(a.key);await pause(100);await page.keyboard.up(a.key);}if(a.x!==undefined)await page.mouse.move(a.x,a.y);if(a.name)await shot(a.name);}await pause(Math.max(0,60000-(Date.now()-t)));await shot('window-after');await close('60-second gameplay window completed');}
 else if(c.action==='quit')await close('bounded completion');else throw Error('unknown action');save('progress.json',{done:n,at:new Date().toISOString()});
}catch(e){errors.push(String(e));await close('command failure');throw e;}}await pause(100);}
await close('deadline');
})().catch(async e=>{errors.push(e.stack||String(e));console.error(e);await close('harness failure');process.exitCode=1});
