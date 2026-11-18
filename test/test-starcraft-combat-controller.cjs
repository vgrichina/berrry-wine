'use strict';
// Authored policy/transport tests only. No original game or retained run data.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const a = require('../tools/starcraft-combat-controller.cjs');
const c = require('../tools/native-supervisor-common.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sc-js-'));
function fields(mode = 'select', extra = {}) {
  return { submittedScene: true, observation: 'Synthetic authored fixture, never original-game evidence', mode,
    sceneType: 'mission', unobstructedMission: true, visibleMissionDescription: 'Authored test window',
    visibleTarget: 'authored client pixel', selectionIntent: 'one selection gesture',
    nativeGroupSelectionSemantics: 'authored Ctrl/box policy metadata', selectedUnitsEvidence: 'synthetic squad metadata',
    nativeCommandSemantics: 'synthetic attack', commandKind: 'attack', armedUnitHUD: 'synthetic rifle HUD',
    visibleAttackCommand: 'synthetic icon', visibleEnemy: 'synthetic target', activeCommandEvidence: 'synthetic target cursor', attackCommandIntent: 'attack',
    pixelGeometry: { source: 'current-full-scene', target: a.read('native-pid.json'), chosenCenter: [240, 240], dragStart: [180, 180] }, ...extra };
}
function fixture(name = 'fresh', mode = 'select', extra = {}) {
  fs.writeFileSync(path.join(a.R, name + '.png'), 'authored image fixture');
  a.save(name + '.json', { at: 499, completedAt: 499.1, target: a.read('native-pid.json'), pngSHA256: c.sha256(Buffer.from('authored image fixture')),
    snapshot: { mainHwnd: '0x1', eip: '0x2', physicalUp: true, capture: '0x0' } });
  a.review(name, fields(mode, extra));
}
async function units() {
  const dir = tmp(); a.R = dir; a.now = () => 500;
  a.save('launch.json', { at: 100, deadline: 1300 }); a.save('native-pid.json', { pid: 123, startToken: 'actual' });
  a.save('mission-admitted.json', { scene: 'synthetic' });
  a.save('attack-combat-order.json', { mode: 'command', commandKind: 'attack', target: a.read('native-pid.json'), at: 498 });
  fixture();
  const keys = ['mousedown:240:240']; a.policy(keys, 'fresh', 'select');
  a.policy(['keydown:17', ...keys], 'fresh', 'select'); a.policy(['mousedown:180:180', 'mousemove:240:240'], 'fresh', 'select');
  let checks = 3;
  for (const bad of [['keydown:18', ...keys], ['rmousedown:240:240'], ['mousedown:180:180', 'mousemove:241:240'], ['mousedown:181:180', 'mousemove:240:240'], ['mousemove:180:180', ...keys], ['mousedown:800:240']]) {
    assert.throws(() => a.policy(bad, 'fresh', 'select')); checks++;
  }
  for (const [mode, bad] of [['select', {selectionIntent:''}], ['select', {nativeGroupSelectionSemantics:''}], ['command', {selectedUnitsEvidence:''}],
    ['command', {nativeCommandSemantics:''}], ['command', {commandKind:'build'}], ['command', {armedUnitHUD:''}], ['command', {visibleAttackCommand:''}],
    ['target', {activeCommandEvidence:''}], ['target', {visibleEnemy:''}], ['target', {attackCommandIntent:'missing'}], ['navigate', {navigationIntent:''}],
    ['quit', {quitRoute:'confirm-quit',visibleQuitTarget:true}]]) {
    const name = 'bad' + checks; fixture(name, mode, bad);
    assert.throws(() => a.policy(mode === 'select' && 'nativeGroupSelectionSemantics' in bad ? ['keydown:17', ...keys] : keys, name, mode, mode === 'quit' ? 'confirm-quit' : null)); checks++;
    // The quit phase is intentionally irreversible; isolate that final case.
  }
  assert.throws(() => a.policy(keys, 'fresh', 'select'), /irreversible/); checks++;
  fs.rmSync(path.join(dir, 'quit-phase.json'));
  a.now = () => 505; assert.throws(() => a.policy(keys, 'fresh', 'select'), /expired/); checks++;
  a.now = () => 500; fixture('menu', 'menu', {nativeMenuPurpose:'pause'}); a.now = () => 520; a.policy(keys, 'menu', 'menu'); checks++;
  a.now = () => 530; assert.throws(() => a.policy(keys, 'menu', 'menu'), /expired/); checks++;
  a.now = () => 500; fixture('target', 'target'); a.policy(keys, 'target', 'target'); checks++;
  a.save('move-combat-order.json', {mode:'command',at:498.5}); assert.throws(() => a.policy(keys, 'target', 'target'), /superseded/); checks++;
  fs.appendFileSync(path.join(dir, 'fresh.png'), 'changed'); assert.throws(() => a.reviewed('fresh'), /image changed/); checks++;
  const owner = {owner:'o',epoch:1}, cancelled = { ...owner, nonce:'n',state:'CANCELLED',queued:false,consumed:false,consumedAt:null,noReplay:true,reason:'immutable deadline expired' };
  assert(a.positivelyUnsent([cancelled], owner, ['n'])); checks++;
  for (const patch of [{state:'UNKNOWN'},{nonce:'other'},{consumed:true},{queued:true},{owner:'foreign'},{consumedAt:1},{reason:'other'}]) { assert(!a.positivelyUnsent([{...cancelled,...patch}],owner,['n'])); checks++; }
  a.save('terminal-input-failure.json',{noReplay:true}); assert.throws(() => a.opened(), /sticky UNKNOWN/); checks++;
  let endpointCalls=0;const originalCall=a.call;
  a.call=async()=>{endpointCalls++;throw Error('must not call closed endpoint');};
  await assert.rejects(a.capture('closed'),/sticky UNKNOWN/);assert.equal(endpointCalls,0);checks++;
  a.call=originalCall;
  fs.unlinkSync(path.join(dir,'terminal-input-failure.json'));
  const originalOpened=a.opened;a.opened=()=>{};
  a.save('input-owner.json',owner);a.call=async()=>{endpointCalls++;throw Error('authored snapshot transport UNKNOWN');};
  await assert.rejects(a.lease(),/transport UNKNOWN/);assert(a.read('terminal-input-failure.json').noReplay);checks++;
  a.opened=originalOpened;
  const beforeClosed=endpointCalls;await assert.rejects(a.capture('closedlease'),/sticky UNKNOWN/);assert.equal(endpointCalls,beforeClosed);checks++;
  a.call=originalCall;
  const originalLease=a.lease;a.lease=async()=>[owner,{}];
  a.save('shot-combat-order.json',{mode:'target',commandKind:'attack',target:a.read('native-pid.json'),at:498});
  for(const [name,change,accepted,proven] of [
    ['unproved',{enemyConsequence:'unproven',attribution:'unproven'},true,false],
    ['fireonly',{enemyConsequence:'damage',attribution:'selected-unit'},false,false],
    ['ambient',{enemyConsequence:'damage',attribution:'selected-unit',persistentConsequenceEvidence:'lower HP persists',otherUnitsFiring:true},false,false],
    ['ambiguous',{enemyConsequence:'damage',attribution:'ambiguous',persistentConsequenceEvidence:'lower HP persists',otherUnitsFiring:true},true,false],
    ['damage',{enemyConsequence:'damage',attribution:'selected-unit',persistentConsequenceEvidence:'lower HP persists'},true,true]]) {
    fixture(name,'target',{settledSceneEvidence:'authored settled scene',consequenceEvidence:'authored consequence metadata',...change});
    if(accepted){await a.recordResult(name,name,'shot');const result=a.read(name+'-combat-result.json');assert.equal(result.objectiveProven,proven);assert.equal(result.missionWinClaim,false);}
    else await assert.rejects(a.recordResult(name,name,'shot'));
    checks++;
  }
  a.lease=originalLease;
  a.now = c.now; fs.rmSync(dir, {recursive:true}); console.log(JSON.stringify({unitChecks:checks,pass:true}));
}
async function nativeBody(out) {
  const net = require('node:net'); a.R = out;
  fs.mkdirSync(out,{recursive:true});
  const exe = path.join(out,'authored.exe'); fs.writeFileSync(exe,require('./test-cli-native-button-delivery.cjs').fixture(0));
  const server = net.createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
  a.URL = `http://127.0.0.1:${port}/ctl`;
  const recipe = {cwd:path.resolve(__dirname,'..'),seconds:240,watchdogGrace:2,args:[process.execPath,'test/run.js','--exe='+exe,'--no-build',
    ...(process.env.STARCRAFT_TEST_MODULE ? ['--wasm='+process.env.STARCRAFT_TEST_MODULE] : []), '--threads','--real-ticks','--screen=800x600','--control='+port,
    '--max-seconds=45','--max-batches=100000000','--quiet-api','--quiet-blocks','--no-close']};
  a.save('recipe.json',recipe);
  const runner = require('../tools/lmarbles-supervisor.cjs').run(out,recipe);
  try {
    const end = Date.now()+15000;
    for (;;) {
      try {const s=await a.call({action:'snapshot'},.5);if(s.focusWindow.live&&s.physicalUp&&s.mainHwnd!=='0x0')break;} catch {}
      assert(Date.now()<end,'native startup');await c.sleep(20);
    }
    await a.capture('bootstrap');a.review('bootstrap',fields('bootstrap',{sceneType:'bootstrap',nativeTitleOrMenu:true}));await a.bind('bootstrap');
    const operations = [['ctrl',['keydown:17','mousedown:240:240'],'select'],['box',['mousedown:180:180','mousemove:240:240'],'select'],['attack',['mousedown:240:240'],'command'],['enemy',['mousedown:240:240'],'target']];
    for (const [name,keys,mode] of operations) {
      const scene=name+'scene';await a.capture(scene);a.review(scene,fields(mode));
      await a.pulse(name,keys,400,scene,mode,null,name==='ctrl');
      const down=a.read(name+'-down.json'),up=a.read(name+'-up.json');
      assert(down.length===keys.length&&down.every(r=>r.state==='CONSUMED'&&r.consumed));
      if(name==='ctrl'){assert.equal(down[0].nativeMessage.msg,0x100);assert.equal(down[0].nativeMessage.wParam,17);assert.equal(down[1].nativeMessage.wParam&8,8);}
      if(name==='box'){assert.equal(down[0].nativeMessage.msg,0x201);assert.equal(down[1].nativeMessage.msg,0x200);assert.equal(down[1].nativeMessage.wParam&1,1);}
      assert(up.state==='ACK'&&down.every(r=>up.at-r.consumedAt/1000<=2));
      assert(a.read(name+'-release-wait.json').actualWait);
      const state=await a.call({action:'snapshot'});assert(state.physicalUp&&state.capture==='0x0');
    }
    // Manual review time is excluded only in authored fixtures: timestamps in
    // workflow records still cover the entire capture/review/dispatch path.
    const workflows=operations.map(([name])=>({name,...a.read(name+'-workflow.json')}));
    a.save('assertions.json',{pass:true,ctrl:true,box:true,separateAttackTarget:true,physicalUP:true,workflows});
    // A real delivery with its reply deliberately lost is actual UNKNOWN.
    // The independent child still releases; afterward no endpoint request is
    // permitted, including a capture or replay. Fault only in authored test.
    await a.capture('lostscene');a.review('lostscene',fields('select'));
    const realCall=a.call;let lost=false;
    a.call=async(command,...args)=>{const value=await realCall(command,...args);if(command.action==='guarded-input'){lost=true;throw Error('authored ACK loss after real consumption');}return value;};
    await assert.rejects(a.pulse('lost',['mousedown:240:240'],400,'lostscene','select'),/ACK loss/);
    assert(lost&&a.read('terminal-input-failure.json').noReplay);
    assert.equal(a.read('lost-up.json').state,'ACK');
    a.call=async()=>{throw Error('unexpected endpoint request after UNKNOWN');};
    await assert.rejects(a.capture('afterunknown'),/sticky UNKNOWN/);
    a.call=realCall;
  } finally {
    a.save('cancel-request.json',{at:c.now(),reason:'authored controls complete',nativeQuit:false});await runner;
    const wait=a.read('native-wait.json');assert(wait.actualWait&&wait.stdoutEOF&&wait.stderrEOF&&wait.exit===0);
  }
}
async function main() {
  if(process.argv[2]==='--native-body')return nativeBody(path.resolve(process.argv[3]));
  if(process.argv[2]==='--native') {
    const out=path.resolve(process.argv[3]||tmp());fs.mkdirSync(out,{recursive:true});
    const receipt=await require('../tools/native-supervise.cjs').supervise(path.join(out,'containment'),[process.execPath,__filename,'--native-body',path.join(out,'native')],
      {deadline:c.now()+65,cleanup_deadline:c.now()+75,grace:2});
    assert.equal(receipt.exit,0);assert.equal(receipt.leaked,false);console.log(JSON.stringify({nativeControls:true,containment:receipt}));return;
  }
  await units();
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fields,units,nativeBody};
