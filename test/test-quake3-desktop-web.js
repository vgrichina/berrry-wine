#!/usr/bin/env node
'use strict';

// Real browser/guest acceptance: WASD and mouse turn measured with Q3's
// viewpos, then a separate mobile browser joins over the normal room card.
const assert = require('assert');
const { quakeConfigWithDefaults } = require('../lib/browser-shell');
const nameDefaults = require('../lib/apps').APPS.quake3_demo.quakeConfigDefaults;
const customNames = 'seta name "My player"\nseta sv_hostname "My server"\n';
assert.strictEqual(quakeConfigWithDefaults(customNames,nameDefaults,'account'),customNames);
assert(quakeConfigWithDefaults('seta name "UnnamedPlayer"\nseta sv_hostname "noname"',nameDefaults,'account').includes('seta name "account"'));
assert(quakeConfigWithDefaults('',nameDefaults,'account').includes('seta sv_hostname "berrry"'));
assert(!quakeConfigWithDefaults('',nameDefaults,null).includes('seta name'));
assert(quakeConfigWithDefaults('',nameDefaults,'a";quit\n\\b').includes('seta name "aquitb"'));
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const WORKERS = process.env.Q3_WORKERS === '1';
if (WORKERS && !process.argv.includes('--isolate')) process.argv.push('--isolate');
const { createServer } = require('../tools/dev-server');
const ROOT = path.join(__dirname, '..');
const OUT = process.env.Q3_OUT || path.join(ROOT, 'scratch/runs/quake3-desktop-web');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!fs.existsSync(CHROME) || !fs.existsSync(path.join(ROOT, require('../lib/apps').APPS.quake3_demo.exe))) {
  console.log('SKIP Chrome or original Quake III demo is not installed');
  process.exit(0);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const timeout = 240000;
const metrics = {};
let dumpId = 0;
function fileText(page, suffix) {
  return page.evaluate(suffix => {
    const vfs = runningApps[0]?.wine?._helpCtx?.vfs;
    const entry = [...(vfs?.files || [])].find(([name]) => name.endsWith(suffix));
    return entry ? new TextDecoder().decode(entry[1].data) : '';
  }, suffix);
}
async function position(page) {
  const name = 'position-' + (++dumpId) + '.txt';
  console.log('Measuring', name);
  const start = (await fileText(page, 'qconsole.log')).length;
  await page.keyboard.press('Backquote'); await sleep(300);
  await page.keyboard.type('/viewpos\n', { delay: 25 });
  // Read a newly completed line in the synchronous game log. condump's
  // confirmation can precede the actual dump writes, so it is not a fence.
  await page.waitForFunction(start => {
    const files = runningApps[0].wine._helpCtx.vfs.files;
    const log = [...files].find(([k]) => k.endsWith('qconsole.log'));
    return log && /\((-?\d+) (-?\d+) (-?\d+)\) : (-?\d+)\r?\n/.test(new TextDecoder().decode(log[1].data).slice(start));
  }, { timeout: 30000 }, start);
  const text = (await fileText(page, 'qconsole.log')).slice(start);
  fs.writeFileSync(path.join(OUT, name), text);
  await page.keyboard.press('Backquote'); await sleep(400);
  const matches = [...text.matchAll(/\((-?\d+) (-?\d+) (-?\d+)\) : (-?\d+)/g)];
  assert(matches.length, 'viewpos must report a loaded gameplay position');
  return matches.at(-1).slice(1).map(Number);
}
async function gameplay(page, count=1) {
  await page.waitForFunction(count => {
    const v = runningApps[0]?.wine?._helpCtx?.vfs;
    const e = [...(v?.files || [])].find(([k]) => k.endsWith('qconsole.log'));
    return e && (new TextDecoder().decode(e[1].data).match(/CL_InitCGame:/g)||[]).length>=count;
  }, { timeout, polling: 500 }, count);
  await sleep(2000);
}
async function hold(page, key, ms=1000) {
  await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); await sleep(500);
}
async function dismissHostCard(page) {
  await page.evaluate(() => { for (const b of document.querySelectorAll('#wine-lan-share button')) if (b.textContent === 'OK') b.click(); });
}
async function touch(page, selector, duration=1000) {
  const el = await page.$(selector); assert(el, selector + ' exists');
  const r = await el.boundingBox(); assert(r, selector + ' visible');
  const cdp = await page.createCDPSession();
  await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2,id:1}] });
  await sleep(duration);
  const held = await page.evaluate(() => sharedRenderer._mouseButtonsMask | 0);
  await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await cdp.detach(); await sleep(500);
  return { held, released: await page.evaluate(() => sharedRenderer._mouseButtonsMask | 0) };
}
(async () => {
  fs.mkdirSync(OUT, {recursive:true});
  fs.copyFileSync(__filename,path.join(OUT,'harness.js'));
  const server=createServer({quiet:true}); await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await puppeteer.launch({headless:true,protocolTimeout:timeout+60000,executablePath:CHROME,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors=[];
  const pages=[];
  const open=async (label,mobile=false)=>{
    const context=await browser.createBrowserContext(); const page=await context.newPage();
    pages.push({page,label});
    await page.setViewport({width:mobile?844:1000,height:mobile?390:760,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
    page.on('console',m=>{fs.appendFileSync(path.join(OUT,label+'.log'),m.text()+'\n');if(/UNIMPLEMENTED API:|RuntimeError|FATAL:/.test(m.text()))errors.push(m.text());});
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(base+(WORKERS?'/?prod&threads':'/?prod&no-threads'),{waitUntil:'domcontentloaded'});
    await page.waitForFunction('typeof launchApp === "function"');
    if (process.env.Q3_ACCOUNT_NAMES === '1') await page.evaluate(label=>{
      const original=window.fetch;
      window.fetch=async (...args)=>{
        const response=await original(...args);
        if (String(args[0]).includes('/api/auth/user') && response.ok) {
          const user=await response.json();
          return new Response(JSON.stringify({...user,username:label+'-player'}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        return response;
      };
    },label);
    return page;
  };
  try {
    const host=await open('host');
    const probeRoom = process.env.Q3_PROBE_ROOM === '1';
    const hostingCard = process.env.Q3_HOSTING_CARD === '1';
    await host.evaluate(menuOnly=>{apps.quake3_demo.args='+set logfile 2 +set g_logSync 1'+(menuOnly?'':' +set sv_maxclients 4 +map q3dm1');document.getElementById('app-select').value='quake3_demo';launchApp();}, hostingCard || probeRoom);
    if (probeRoom) {
      const menu = page => page.waitForFunction(()=>{
        const w=runningApps[0]?.wine;
        return w?.running && new DataView(w.memory.buffer).getUint32(w.instance.exports.guest_to_wasm(0x6dc1a4),true)===2;
      },{timeout});
      const offline = async (page, label) => {
        await sleep(5000);
        const state=await page.evaluate(()=>{const w=runningApps[0].wine;return {
          worker:!!w.guestWorker,room:!!w._lanRoom,local:!!w.vlanWire?.localOnly,
          hosting:!!w._localLanProbe?.probe.hosting,networked:w._isNetworked(),
          card:!!document.querySelector('#wine-lan-card,#wine-lan-share'),roomUrl:new URL(location.href).searchParams.has('room')};});
        assert.deepStrictEqual(state,{worker:WORKERS,room:false,local:true,hosting:false,networked:false,card:false,roomUrl:false},label);
        metrics[label]=state;
      };
      const command=async(page,text)=>{await page.keyboard.press('Backquote');await sleep(300);await page.keyboard.type(text+'\n',{delay:25});};
      await menu(host);await offline(host,'menuOffline');
      if (process.env.Q3_ACCOUNT_NAMES === '1') {
        const cfg=await fileText(host,'q3config.cfg');
        assert(cfg.includes('seta name "host-player"'));
        assert(cfg.includes('seta sv_hostname "berrry"'));
        metrics.accountDefaults=true;
      }
      await host.screenshot({path:path.join(OUT,'menu-local-only.png')});
      if (process.env.Q3_EMPTY_DISCOVERY === '1') {
        await host.evaluate(()=>{
          const original=VlanRoom.hostedRooms;
          window.emptyDiscoveryCalls=0;
          VlanRoom.hostedRooms=async (...args)=>{
            await original(...args);
            window.emptyDiscoveryCalls++;
            return []; // Deterministic empty directory, regardless of other tests.
          };
        });
        await host.keyboard.press('ArrowDown');await host.keyboard.press('Enter');
        await host.waitForFunction(()=>window.emptyDiscoveryCalls>0,{timeout:30000});
        await offline(host,'emptyMultiplayerOffline');
        await host.screenshot({path:path.join(OUT,'multiplayer-empty-no-overlay.png')});
        await host.evaluate(()=>{VlanRoom.hostedRooms=async()=>[
          {userId:'test-other-host',name:'Other player',hosting:{label:'Test server'}}
        ];});
        await command(host,'/localservers');
        await host.waitForSelector('#wine-lan-card button[data-choice="own"]',{timeout:30000});
        await host.screenshot({path:path.join(OUT,'picker-host-option.png')});
        await host.click('#wine-lan-card button[data-choice="own"]');
        await offline(host,'hostChoiceStillOffline');
        await host.keyboard.press('Backquote');
        await host.screenshot({path:path.join(OUT,'host-choice-native-create.png')});
        assert.deepStrictEqual(errors,[]);
        console.log('PASS empty discovery stays silent; Host a game returns to native Create without publishing');
        return;
      }
      const quickJoin=process.env.Q3_QUICK_JOIN==='1';
      if (!quickJoin) {
      await command(host,'/spmap q3dm1');await gameplay(host);
      await offline(host,'soloOffline');
      await host.screenshot({path:path.join(OUT,'single-player-local-only.png')});
      await command(host,'/g_gametype');await sleep(1000);
      assert(/"g_gametype" is:"2/.test(await fileText(host,'qconsole.log')),'guest entered real single-player mode');
      await host.keyboard.press('Backquote');
      await command(host,'/disconnect');await menu(host);
      }
      await command(host,'/set g_gametype 0; set sv_maxclients 4; map q3dm1');
      await host.waitForSelector('#wine-lan-share',{timeout});
      await dismissHostCard(host);
      metrics.host=await host.evaluate(async()=>{const w=runningApps[0].wine;return {role:w._lanRoom.role,worker:!!w.guestWorker,ip:await w.callGuest('get_vlan_local_ip'),local:!!w._localLanProbe};});
      assert.deepStrictEqual(metrics.host,{role:'owner',worker:WORKERS,ip:0x0a000001,local:false});
      await gameplay(host,quickJoin?1:2);
      await host.screenshot({path:path.join(OUT,'multiplayer-public.png')});
      const guest=await open('discovery');
      await guest.evaluate(()=>{apps.quake3_demo.args='+set logfile 2';document.getElementById('app-select').value='quake3_demo';launchApp();});
      await guest.waitForSelector('#wine-lan-card .wine-lan-room button',{timeout:60000});
      await guest.screenshot({path:path.join(OUT,'launch-active-server-picker.png')});
      await guest.click('#wine-lan-card button[data-choice="skip"]');
      await menu(guest);await offline(guest,'menuWithHostOffline');
      await guest.evaluate(()=>{window.originalQ3Wine=runningApps[0].wine;});
      await command(guest,'/localservers');
      await guest.waitForSelector('#wine-lan-card .wine-lan-room button',{timeout:60000});
      await guest.screenshot({path:path.join(OUT,'discovery-picker.png')});
      await guest.click('#wine-lan-card .wine-lan-room button');
      await gameplay(guest);
      metrics.discovery=await guest.evaluate(async()=>{const w=runningApps[0].wine;return {role:w._lanRoom.role,ip:await w.callGuest('get_vlan_local_ip'),worker:!!w.guestWorker};});
      assert.deepStrictEqual(metrics.discovery,{role:'member',ip:0x0a000002,worker:WORKERS});
      assert(await guest.evaluate(()=>window.originalQ3Wine===runningApps[0].wine),'joining must preserve the original Q3 instance');
      assert((await fileText(guest,'qconsole.log')).includes('net_restart; connect 10.0.0.1'),'join reopens sockets and connects through console');
      metrics.joinWithoutRestart=true;
      await guest.screenshot({path:path.join(OUT,'discovery-joined.png')});
      const invited=await open('invited');
      const inviteUrl=host.url();
      await invited.evaluate(url=>{history.replaceState(null,'',url);apps.quake3_demo.args='+set logfile 2';document.getElementById('app-select').value='quake3_demo';launchApp();},inviteUrl);
      await gameplay(invited);
      metrics.invited=await invited.evaluate(async()=>{const w=runningApps[0].wine;return {role:w._lanRoom.role,ip:await w.callGuest('get_vlan_local_ip'),worker:!!w.guestWorker};});
      assert.deepStrictEqual(metrics.invited,{role:'member',ip:0x0a000003,worker:WORKERS});
      await invited.screenshot({path:path.join(OUT,'invited-joined.png')});
      assert.deepStrictEqual(errors,[]);
      console.log('PASS menu and solo stay local; multiplayer promotes; native discovery and invitation join in requested execution mode');
      return;
    }
    if (hostingCard) {
      await host.waitForFunction(()=>{const w=runningApps[0]?.wine;return w?.instance && new DataView(w.memory.buffer).getUint32(w.instance.exports.guest_to_wasm(0x6dc1a4),true)===2;},{timeout});
      await sleep(6000);
      assert.strictEqual(await host.$('#wine-lan-share'),null,'main menu must not claim to host a game');
      await host.screenshot({path:path.join(OUT,'menu-no-host-card.png')});
      await host.keyboard.press('Backquote');await sleep(300);
      await host.keyboard.type('/set sv_maxclients 4\n/map q3dm1\n',{delay:25});
    }
    if (hostingCard) {
      await gameplay(host);
      await host.waitForSelector('#wine-lan-share',{timeout:15000});
      await host.screenshot({path:path.join(OUT,'server-host-card.png')});
      await dismissHostCard(host);await sleep(11000);
      assert.strictEqual(await host.$('#wine-lan-share'),null,'probe refresh must not reopen a dismissed share card');
      metrics.hostingCard={absentAtMenu:true,presentWhenServing:true,staysDismissed:true};
      assert.deepStrictEqual(errors,[]);
      console.log('PASS no hosting card at menu; card appears for real server and stays dismissed');
      return;
    }
    await gameplay(host); console.log('Host entered gameplay'); await dismissHostCard(host);
    metrics.hostIp=await host.evaluate(async()=>{const w=runningApps[0].wine;return {worker:!!w.guestWorker,assigned:w.vlanLocalIp,actual:await w.callGuest('get_vlan_local_ip')};});
    assert.strictEqual(metrics.hostIp.worker,WORKERS,'requested host execution mode must be active');
    assert.strictEqual(metrics.hostIp.actual,0x0a000001,'host guest uses owner IP');
    const cfg=await fileText(host,'q3config.cfg');
    for(const [key,cmd] of Object.entries({w:'+forward',s:'+back',a:'+moveleft',d:'+moveright',MOUSE1:'+attack',SPACE:'+moveup',CTRL:'+movedown'})) assert(cfg.includes(`bind ${key} "${cmd}"`),key+' binding in guest-written config');
    metrics.start=await position(host);
    await hold(host,'w');metrics.forward=await position(host);
    assert.notDeepStrictEqual(metrics.forward.slice(0,2),metrics.start.slice(0,2),'W moves in the actual guest');
    await hold(host,'s');metrics.back=await position(host);
    assert.notDeepStrictEqual(metrics.back.slice(0,2),metrics.forward.slice(0,2),'S moves back');
    await hold(host,'a');metrics.left=await position(host);
    await hold(host,'d');metrics.right=await position(host);
    assert.notDeepStrictEqual(metrics.left.slice(0,2),metrics.back.slice(0,2),'A strafes');
    assert.notDeepStrictEqual(metrics.right.slice(0,2),metrics.left.slice(0,2),'D strafes');
    const box=await (await host.$('#screen')).boundingBox();
    await host.mouse.click(box.x+box.width/2,box.y+box.height/2);
    await host.waitForFunction(()=>document.pointerLockElement===document.getElementById('screen'),{timeout:10000});
    await host.mouse.move(box.x+box.width/2+110,box.y+box.height/2,{steps:8});await sleep(600);
    metrics.mouse=await position(host);
    assert.notStrictEqual(metrics.mouse[3],metrics.right[3],'pointer-locked mouse changes guest yaw');
    await host.mouse.down();await sleep(1200);await host.mouse.up();
    await host.screenshot({path:path.join(OUT,'desktop.png')});
    await host.keyboard.press('Escape');
    // CDP dispatches Escape to the guest but does not exercise Chrome's
    // browser-chrome escape shortcut. Exercise the same pointerlockchange
    // release path explicitly, then verify reacquisition without a jump.
    await host.evaluate(()=>document.exitPointerLock());
    await host.waitForFunction(()=>!document.pointerLockElement,{timeout:10000});
    await host.mouse.move(box.x+box.width*.7,box.y+box.height*.4,{steps:4});
    await host.mouse.click(box.x+box.width/2,box.y+box.height/2);
    await host.waitForFunction(()=>document.pointerLockElement===document.getElementById('screen'),{timeout:10000});
    metrics.recapture=await position(host);
    assert.strictEqual(metrics.recapture[3],metrics.mouse[3],'unlocked absolute motion and recapture do not jump the view');
    await host.evaluate(()=>document.exitPointerLock());
    console.log('PASS desktop WASD and captured mouse alter guest gameplay');

    const guest=await open('mobile',true);
    if (process.env.Q3_RUNNING_JOIN !== '1') {
      // An explicit room invitation retains the pre-launch join path while
      // ordinary launches with openOnProbe stay local at their menus.
      await guest.evaluate(url=>history.replaceState(null,'',url),host.url());
    } else {
      // Retain coverage of the legacy running-game recipe for apps that
      // don't opt into local probing.
      await guest.evaluate(()=>{apps.quake3_demo.lan.openOnProbe=false;});
    }
    await guest.evaluate(()=>{apps.quake3_demo.args='+set logfile 2';document.getElementById('app-select').value='quake3_demo';launchApp();});
    if (process.env.Q3_RUNNING_JOIN === '1') {
      await guest.waitForSelector('#wine-lan-card .wine-lan-room button',{timeout:60000});
      await guest.evaluate(()=>[...document.querySelectorAll('#wine-lan-card button')].find(b=>b.textContent==='Play offline').click());
      await guest.waitForFunction(()=>runningApps[0]?.wine?.instance && !runningApps[0].wine.vlanWire,{timeout});
      await guest.waitForSelector('#wine-lan-card .wine-lan-room button',{timeout:90000});
      await guest.click('#wine-lan-card .wine-lan-room button');
    }
    await gameplay(guest);
    metrics.clientIp=await guest.evaluate(async()=>{const w=runningApps[0].wine;return {worker:!!w.guestWorker,assigned:w.vlanLocalIp,actual:await w.callGuest('get_vlan_local_ip')};});
    assert.strictEqual(metrics.clientIp.worker,WORKERS,'requested client execution mode must be active');
    assert.strictEqual(metrics.clientIp.actual,0x0a000002,'client guest uses assigned member IP');
    await host.waitForFunction(()=>{
      const e=[...runningApps[0].wine._helpCtx.vfs.files].find(([k])=>k.endsWith('games.log'));
      return e && /ClientBegin: 1/.test(new TextDecoder().decode(e[1].data));
    },{timeout});
    await guest.waitForFunction(()=>{
      const w=runningApps[0]?.wine.vlanWire;
      return w && w.sentFrames>50 && w.recvFrames>100;
    },{timeout:60000});
    metrics.network=await guest.evaluate(()=>{const w=runningApps[0].wine.vlanWire;return {address:w.address,sent:w.sentFrames,recv:w.recvFrames,args:runningApps[0].wine._extraArgs,datagram:w.link?.dgChannel?.readyState};});
    assert.strictEqual(metrics.network.address,'10.0.0.2');
    assert(metrics.network.sent>50&&metrics.network.recv>100,'bidirectional game traffic');
    assert.strictEqual(metrics.network.datagram,'open');
    if (process.env.Q3_RUNNING_JOIN === '1') {
      assert(!metrics.network.args?.includes('+connect'), 'running join must use the console, not launch arguments');
      await guest.keyboard.press('Backquote'); await sleep(300);
      await guest.keyboard.type('/localservers\n', {delay:25});
      await guest.waitForFunction(()=>{
        const w=runningApps[0].wine;
        return new DataView(w.memory.buffer).getUint32(w.instance.exports.guest_to_wasm(0x6dc250),true)>0;
      },{timeout:30000});
      metrics.localServers=await guest.evaluate(()=>{
        const w=runningApps[0].wine;
        return new DataView(w.memory.buffer).getUint32(w.instance.exports.guest_to_wasm(0x6dc250),true);
      });
      await guest.keyboard.press('Backquote'); await sleep(300);
      console.log('PASS running-game console join and native LAN server discovery');
    }
    metrics.mobileStart=await position(guest);
    await touch(guest,'.tc-up');metrics.mobileForward=await position(guest);
    assert.notDeepStrictEqual(metrics.mobileForward.slice(0,2),metrics.mobileStart.slice(0,2),'touch movement changes guest position');
    const cdp=await guest.createCDPSession();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:440,y:150,id:2}]});
    for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:440+i*10,y:150,id:2}]});await sleep(50);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await sleep(500);
    metrics.mobileAim=await position(guest);assert.notStrictEqual(metrics.mobileAim[3],metrics.mobileForward[3],'touch look turns guest view');
    metrics.mobileFire=await touch(guest,'button[aria-label="Fire"]',1200);
    assert(metrics.mobileFire.held&1,'touch Fire holds mouse attack');
    assert.strictEqual(metrics.mobileFire.released&1,0,'touch Fire releases attack');
    await guest.screenshot({path:path.join(OUT,'mobile.png')});
    await guest.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});await sleep(800);
    metrics.portrait=await guest.evaluate(()=>[...document.querySelectorAll('.tc-btn,.tc-arrow')].map(el=>{const r=el.getBoundingClientRect();return {label:el.getAttribute('aria-label'),x:r.x,y:r.y,w:r.width,h:r.height};}));
    for(const r of metrics.portrait.filter(r=>r.w&&r.h)) assert(r.x>=0&&r.y>=0&&r.x+r.w<=391&&r.y+r.h<=845,'portrait control fits: '+JSON.stringify(r));
    await guest.screenshot({path:path.join(OUT,'mobile-portrait.png')});
    fs.writeFileSync(path.join(OUT,'server-game.log'),await fileText(host,'games.log'));
    assert.deepStrictEqual(errors,[]);
    console.log('PASS browser room join, two-player guest session, mobile move and look');
  } finally {
    for(const {page,label} of pages) {
      try {
        await Promise.race([
          (async()=>{
            for(const name of ['qconsole.log','games.log']) fs.writeFileSync(path.join(OUT,label+'-'+name),await fileText(page,name));
            await page.screenshot({path:path.join(OUT,label+'-final.png')});
          })(),sleep(15000),
        ]);
      } catch (_) {}
    }
    fs.writeFileSync(path.join(OUT,'metrics.json'),JSON.stringify({metrics,errors},null,2));
    await browser.close();await new Promise(r=>server.close(r));
  }
})().catch(e=>{console.error(e);process.exitCode=1});
