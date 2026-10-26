'use strict';
// Refactored from pinned 2f0f8784 predecessor; runner/game are never imported or changed.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const {CapturePlan} = require('./civ2-capture-plan');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function createController(config, deps = {}) {
  const {outputDir: R, referenceDir: P, sessionId} = config;
  if (!path.isAbsolute(R || '') || !path.isAbsolute(P || '') || !/^[A-Za-z0-9_-]+$/.test(sessionId || '')) throw Error('explicit absolute task paths and unique sessionId required');
  const now = deps.now || Date.now, plan = new CapturePlan(config.plan, now);
  let serial = 0, busy = false, poisoned = false, started = false, lastImage;
  let owner, startAttempted = false, launchAttempted = false, runAttempted = false;
  const ownerPath = path.join(R, 'controller-owner.json');
  // This exclusive claim is also a permanent no-restart tombstone. Never unlink
  // it (even on an empty/failed write, shutdown or apparently dead owner). A new
  // invocation cannot infer whether a launcher/request already executed.
  function claimOwnership() {
    const directory = fs.statSync(R);
    const token = crypto.randomBytes(32).toString('hex');
    let fd;
    try { fd = fs.openSync(ownerPath, 'wx', 0o600); }
    catch (e) { throw Error('existing task ledger/ownership unavailable; no allowance reset or uncertain replay', {cause:e}); }
    try {
      const inode = fs.fstatSync(fd);
      const bytes = JSON.stringify({sessionId, allocationId:config.plan.allocationId, token}) + '\n';
      fs.writeFileSync(fd, bytes); fs.fsyncSync(fd);
      owner = {directory, inode, bytes};
    } finally { fs.closeSync(fd); }
  }
  function assertOwnership() {
    try {
      if (!owner) throw Error('inactive owner');
      const directory = fs.statSync(R), inode = fs.lstatSync(ownerPath);
      if (directory.dev !== owner.directory.dev || directory.ino !== owner.directory.ino ||
          !inode.isFile() || inode.dev !== owner.inode.dev || inode.ino !== owner.inode.ino ||
          fs.readFileSync(ownerPath, 'utf8') !== owner.bytes) throw Error('replaced owner');
    } catch (e) {
      poisoned = true; started = false; plan.stopped = true;
      throw Error('task lifetime ownership lost/inactive; STOP without cleanup or replay', {cause:e});
    }
  }
  const checks = [];
  // pngjs is loaded only for real capture/inspection, never for preflight.
  const decode = deps.decode || (b => require('pngjs').PNG.sync.read(b));
  function put(name, value) {
    assertOwnership();
    if (deps.put) return deps.put(name, value);
    const p = path.join(R, name);
    fs.writeFileSync(p + '.tmp', JSON.stringify(value, null, 2) + '\n'); fs.renameSync(p + '.tmp', p);
  }
  function persist() { put('capture-plan.json', plan.snapshot()); }
  async function fileRequest(req) {
    assertOwnership();
    fs.appendFileSync(path.join(R, 'control-in.jsonl'), JSON.stringify(req) + '\n');
    const until = now() + config.plan.ackTimeoutMs;
    while (now() < until) {
      const file = path.join(R, 'guest.log');
      const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : [];
      const acks = lines.filter(l => l.startsWith('[ctl] ')).map(l => JSON.parse(l.slice(6))).filter(o => o.id === req.id);
      if (acks.length > 1) throw Error('duplicate ACK ownership');
      if (acks.length === 1) return acks[0];
      await sleep(10);
    }
    throw Error('unacknowledged request; STOP without replay');
  }
  async function ctl(req) {
    assertOwnership();
    if (!started || poisoned || busy) { poisoned = true; plan.stopped = true; throw Error('serial ownership inactive/busy; no replay'); }
    plan.guard(config.plan.ackTimeoutMs);
    busy = true;
    const sent = {...req, id: sessionId + '-' + (++serial)};
    let timer;
    try {
      const ack = await Promise.race([(deps.request || fileRequest)(sent), new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('unacknowledged request; no replay')), config.plan.ackTimeoutMs);
      })]);
      assertOwnership();
      if (ack.id !== sent.id || ack.ok !== true) throw Error('failed/stale ACK ownership');
      plan.guard();
      return ack.value;
    } catch (e) { plan.stopped = true; try { persist(); } finally { poisoned = true; } throw e; }
    finally { clearTimeout(timer); busy = false; }
  }
  async function frozen() {
    const s = await ctl({action: 'snapshot'});
    if (!s?.frozen?.frozen || s.frozen.credits !== 0) { poisoned = true; plan.fail('not frozen zero'); }
    return s;
  }
  async function step(n) {
    plan.verified = false; lastImage = undefined;
    const a = await ctl({action: 'step', n});
    if (a.ran !== n || !a.frozen) { poisoned = true; plan.fail('step incomplete; no replay'); }
    return frozen();
  }
  async function input(cmd) {
    plan.beforeInput(); await frozen(); plan.beforeInput();
    return ctl({cmd});
  }
  async function capture(name) {
    assertOwnership();
    if (!/^[a-z0-9-]+$/.test(name)) plan.fail('invalid capture name');
    plan.beginCapture(name); persist();
    const p = path.join(R, name + '.png');
    let requested = false;
    try {
      await frozen();
      if (fs.existsSync(p)) throw Error('capture output already exists; no overwrite');
      requested = true;
      await ctl({action: 'png', path: p});
      if (!deps.readFile) plan.observeCaptureBytes(fs.statSync(p).size);
      const b = (deps.readFile || fs.readFileSync)(p);
      if (deps.readFile) plan.observeCaptureBytes(b.length);
      const im = decode(b);
      plan.finishCapture(b.length, im.width, im.height);
      lastImage = im; persist(); return im;
    } catch (e) {
      if (requested && plan.records.at(-1).retainedBytes === undefined && fs.existsSync(p)) {
        try { plan.observeCaptureBytes(fs.statSync(p).size); } catch (_) { /* retained rejection stays recorded */ }
      }
      plan.stopped = true; try { persist(); } finally { poisoned = true; } throw e;
    }
  }
  function crop(im, [x,y,w,h]) {
    if (![x,y,w,h].every(Number.isInteger) || x<0 || y<0 || w<=0 || h<=0 || x+w>im.width || y+h>im.height) plan.fail('invalid pixel rectangle');
    const b=Buffer.alloc(w*h*4);
    for(let j=0;j<h;j++) im.data.copy(b,j*w*4,((y+j)*im.width+x)*4,((y+j)*im.width+x+w)*4);
    return b;
  }
  function match(name, im, rects, donor=P) {
    if (im !== lastImage || !Array.isArray(rects) || !rects.length) plan.fail('current presented pixels required');
    const reference = path.join(donor, name + '.png');
    const bytes = (deps.readFile || fs.readFileSync)(reference), ref = decode(bytes);
    const parts = rects.map(rect => { const a=crop(im,rect), b=crop(ref,rect); return {rect,actual:hash(a),reference:hash(b),equal:a.equals(b)}; });
    const ok = parts.every(p => p.equal);
    checks.push({name,reference,referenceSHA256:hash(bytes),parts,ok}); put('pixel-checkpoints.json',{checks});
    if (!ok) { poisoned = true; plan.fail('presented pixels differ at '+name); }
    plan.verify(); persist();
  }
  async function state(name,rects) {
    const im=await capture(name); match(name,im,rects);
    put('durable-controller.json',{stage:name,inputsAcknowledged:serial,pixelChecks:checks.length,remaining:'production UI inspection and normal quit'});
    return im;
  }
  async function advance(name,rects,cmds,n) {
    await state(name,rects); for(const c of cmds)await input(c); return step(n);
  }
  function start() {
    // Must precede the first step AND any caller-owned guest launch.
    if (startAttempted) { poisoned = true; started = false; plan.fail('controller already started/attempted; no replay'); }
    startAttempted = true;
    try {
      plan.admit(); // Read-only admission; an impossible plan cannot launch.
      claimOwnership(); // Atomic across launcher AND standalone invocations.
      if (fs.existsSync(path.join(R, 'capture-plan.json')) || fs.existsSync(path.join(R, 'control-in.jsonl'))) plan.fail('existing task ledger/control stream; no allowance reset or uncertain replay');
      persist(); started = true;
    } catch (e) { poisoned = true; started = false; plan.stopped = true; throw e; }
  }
  async function launch() {
    assertOwnership();
    if (!started || poisoned || plan.stopped || launchAttempted) { poisoned = true; plan.fail('launcher already attempted/inactive; no replay'); }
    launchAttempted = true;
    try {
      await deps.launch(); assertOwnership();
      if (poisoned || !started || plan.stopped) throw Error('launcher lifetime became inactive; no replay');
    }
    catch (e) { plan.stopped = true; try { persist(); } finally { poisoned = true; started = false; } throw e; }
  }
  async function setup() {
 await step(500);
 await advance('language',[[100,215,440,45],[100,270,220,20]],['click:210:280'],150);
 await advance('heralds',[[100,145,440,160],[100,317,440,20]],['click:320:327'],200);
 // A rendered movie signature plus visible intro window geometry, never title alone.
 const intro=await capture('intro');const snap=await ctl({action:'snapshot'});
 let black=0,colored=0;for(let y=0;y<480;y++)for(let x=0;x<640;x++){const i=(y*640+x)*4,r=intro.data[i],g=intro.data[i+1],b=intro.data[i+2];if(y<115||y>=365){if(r+g+b<15)black++;}else if(x>170&&x<460&&y>180&&y<300&&r>80&&r>g&&g>b)colored++;}
 const visible=snap.windows.filter(w=>w.visible&&!w.isChild);const ok=black>140000&&colored>4000&&visible.some(w=>w.w>=600&&w.h>=400);
 put('intro-checkpoint.json',{blackBorderPixels:black,centralLogoColoredPixels:colored,visible,ok,frameSHA256:hash((deps.readFile || fs.readFileSync)(R+'/intro.png'))});if(!ok)throw Error('unknown presented intro');plan.verify();
 await input('keydown:27');await input('keyup:27');await step(300);
 await advance('post-intro',[[430,270,200,175]],['click:478:464'],200);
 await advance('world',[[160,352,320,95]],['click:180:391','click:320:464'],200);
 await advance('difficulty',[[10,287,320,160]],['click:90:465'],200);
 await advance('civilizations',[[310,310,320,137]],['click:327:435','click:468:465'],200);
 await advance('barbarians',[[10,330,320,117]],['click:172:465'],150);
 await advance('rules',[[310,375,320,72]],['click:385:465'],150);
 await advance('gender',[[160,375,320,72]],['click:235:465'],150);
 await advance('tribe',[[20,265,600,182]],['click:320:465'],150);
 await advance('name',[[100,393,440,24],[102,421,88,16]],['click:210:465'],250);
 await advance('ready',[[310,215,320,235]],['click:388:465'],300);
 await advance('map-entry',[[70,345,500,22],[140,371,265,14],[80,453,480,14]],['click:320:460'],200);
 await advance('map-before',[[90,10,460,93],[95,112,450,13]],['click:320:118'],50);
 await state('gameplay-before',[[180,46,100,18],[520,267,70,34],[470,305,50,12]]);
 await input('click:174:31');await step(10);await capture('orders-menu');

  }
  async function decision(d) {
    if (!d || !Array.isArray(d.cmds || [])) plan.fail('invalid decision');
    if ((d.cmds || []).length) {
      if (!d.presented || d.presented.stage !== plan.route[plan.index]) plan.fail('decision needs current presented stage');
      match(d.presented.referenceName, lastImage, d.presented.rects, d.presented.referenceDir || P);
      for (const c of d.cmds) await input(c);
    }
    if (d.step) await step(d.step);
    if (d.capture) await capture(d.capture);
    const snap = await frozen();
    // A stop flag records handoff only. It never establishes successful gameplay/quit.
    return {serial,snap,at:new Date(now()).toISOString(),acceptanceComplete:false};
  }
  async function run() {
    if (runAttempted) { poisoned = true; plan.fail('controller run already attempted; no replay'); }
    runAttempted = true;
    try {
      if (!started) start();
      await setup(); put('interactive-ready.json',{stage:'orders-menu',at:new Date(now()).toISOString(),serial});
      let i=0;
      while(true) {
        const file=path.join(R,'decision-'+(++i)+'.json');
        while(!fs.existsSync(file)) { plan.guard(); await sleep(10); }
        const d=JSON.parse(fs.readFileSync(file));
        put('decision-'+i+'-ack.json',await decision(d));
        if(d.stop)break;
      }
    } finally {
      plan.stopped = true;
      try { if (owner) persist(); }
      finally { poisoned = true; started = false; }
    }
  }
  return {start,launch,run,setup,capture,match,input,step,decision,plan,snapshot:()=>plan.snapshot()};
}

async function launchController(config, deps) {
  const controller = createController(config, deps);
  controller.start(); // No launch/input on impossible plans.
  await controller.launch();
  return controller;
}
if (require.main === module) {
  const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const controller = createController(config);
  if (process.argv.includes('--preflight')) {
    // Read-only admission, usable by a launcher before creating the one live ledger.
    const plan = new CapturePlan(config.plan); plan.admit(); console.log(JSON.stringify(plan.snapshot()));
  }
  else controller.run().catch(e => { console.error(e.stack); process.exitCode=1; });
}
module.exports = {createController, launchController};
