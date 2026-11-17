'use strict';
// Actual Chrome transport. No AoW or guest mutations in supervision tests.
const fs=require('fs'), assert=require('assert/strict');
const mode=process.argv[2],out=process.env.AOW_CUSTODY_OUT;
(async()=>{
 const browser=await require('../../node_modules/puppeteer').connect({browserWSEndpoint:process.env.AOW_BROWSER_ENDPOINT});
 const page=await browser.newPage();await page.goto('data:text/html,<title>owned browser custody</title><h1>Live Chrome</h1>');
 assert.equal(await page.title(),'owned browser custody');
 fs.writeFileSync(out+'/client-ready.pending',JSON.stringify({mode,connected:true,pid:process.pid}));fs.renameSync(out+'/client-ready.pending',out+'/client-ready.json');
 if(mode==='backlog'){
  for(const name of ['stdout','stderr'])await new Promise(r=>process[name].write(Buffer.alloc(2*1024*1024,name==='stdout'?65:66),r));
 }
 if(mode==='failure')process.exit(7);
 if(mode==='normal'||mode==='backlog'){await browser.close();return;}
 if(mode==='chrome-failure')process.kill(JSON.parse(fs.readFileSync(out+'/browser.json')).pid,'SIGKILL');
 await new Promise(()=>{});
})().catch(e=>{console.error(e);process.exitCode=1;});
