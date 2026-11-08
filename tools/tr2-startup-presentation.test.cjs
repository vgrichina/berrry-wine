'use strict';

// Exercise the real shell timer body, without launching an EXE. The Chrome
// fixture also uses the shipped renderer's ShowWindow/compositor path.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');

function maximizeSource(source) {
  const start = source.indexOf('    function maximizeForSingleApp(wine) {');
  const end = source.indexOf('\n    // Registry `mdiCrop`', start);
  assert(start >= 0 && end > start);
  return source.slice(start, end);
}

function unit(source) {
  let tick, cleared = 0, messages = 0;
  const instance = { exports: { send_message() { messages++; } } };
  const wine = { instance };
  const main = { hwnd: 65537, wasm: instance, visible: true, style: 0xcf0000,
    w: 400, h: 300, x: 0, y: 0 };
  const dialog = { hwnd: 65538, wasm: instance, visible: true, isDialog: true };
  const renderer = { windows: { 65537: main, 65538: dialog }, canvas: { width: 780, height: 437 },
    _windowOwnerHwnd: () => 0, prepareSingleAppMaximize: () => false };
  const context = { SINGLE_APP: () => true, sharedRenderer: renderer,
    runningApps: [{ wine }], WS_MAXIMIZEBOX: 0x10000, WS_THICKFRAME: 0x40000,
    setInterval: callback => { tick = callback; return 1; },
    clearInterval: () => { cleared++; }, appendDebugLog() {}, window: {} };
  vm.runInNewContext(maximizeSource(source) + '\nthis.maximize = maximizeForSingleApp;', context);
  context.maximize(wine);
  for (let i = 0; i < 130 && !cleared; i++) tick();
  assert.equal(messages, 0, 'a live startup dialog must postpone SC_MAXIMIZE');
  assert.equal(cleared, 0, 'waiting for the dialog must not consume or retire the timer');
  dialog.visible = false;
  tick();
  assert.equal(messages, 1, 'maximize once after the startup dialog closes');
  assert.equal(cleared, 1);
  // Waiting on a dialog must still honor the ordinary lifecycle stops.
  cleared = messages = 0; dialog.visible = true;
  context.maximize(wine); context.runningApps.length = 0; tick();
  assert.equal(cleared, 1, 'app exit cancels even while a dialog is visible');
  assert.equal(messages, 0);
  cleared = 0; context.runningApps.push({wine}); renderer._exclusiveFullscreen = true;
  context.maximize(wine); tick();
  assert.equal(cleared, 1, 'exclusive display cancels even while a dialog is visible');
  assert.equal(messages, 0);
  cleared = 0; renderer._exclusiveFullscreen = false; dialog.wasm = {};
  context.maximize(wine); tick();
  assert.equal(messages, 1, 'another instance dialog does not block maximization');
  assert.equal(cleared, 1);
  return { passed: true, dialogTicks: 130, maximizeAfterClosure: true,
    appExitCancellation: true, exclusiveCancellation: true, instanceScoped: true };
}

async function chromeFixture(out) {
  const puppeteer = require('puppeteer');
  const selected = JSON.parse(fs.readFileSync(path.join(root,
    'scratch/runs/20261108-tr2-observer-coverage-1733/runtime-pins.json')));
  const source = name => {
    const pin = selected.files.find(p => p.path === name);
    const data = cp.execFileSync('git', ['show', pin.source.commit + ':' + name]);
    assert.equal(require('node:crypto').createHash('sha256').update(data).digest('hex'), pin.sha256);
    return data.toString();
  };
  const oldShell = source('lib/browser-shell.js');
  const fixedShell = fs.readFileSync(path.join(root, 'lib/browser-shell.js'), 'utf8');
  const browser = await puppeteer.launch({executablePath: '/usr/bin/google-chrome', headless: true,
    defaultViewport: null, args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check',
      '--disable-dev-shm-usage', '--enable-unsafe-swiftshader']});
  fs.writeFileSync(path.join(out, 'fixture-browser.json'), JSON.stringify({pid: browser.process().pid,
    args: browser.process().spawnargs, version: await browser.version()}));
  try {
    const page = (await browser.pages())[0];
    await page.setContent('<style>body{margin:0}</style><canvas id="screen" width="780" height="437"></canvas>');
    for (const name of ['lib/surface.js', 'lib/renderer.js', 'lib/renderer-input.js']) {
      await page.addScriptTag({content: source(name)});
    }
    const results = {};
    for (const [label, shell] of [['before', oldShell], ['after', fixedShell]]) {
      results[label] = await page.evaluate(body => {
        const canvas = document.getElementById('screen');
        const renderer = new Win98Renderer(canvas);
        // Authored stand-ins for already completed startup GDI surfaces, no
        // CPU module, PE, D3D context, guest input or memory writes involved.
        const blank = document.createElement('canvas'); blank.width = 780; blank.height = 437;
        blank.getContext('2d').fillStyle = '#c0c0c0'; blank.getContext('2d').fillRect(0, 0, 780, 437);
        const sheet = document.createElement('canvas'); sheet.width = 366; sheet.height = 373;
        const g = sheet.getContext('2d'); g.fillStyle = '#e0e0e0'; g.fillRect(0,0,366,373);
        g.fillStyle = '#000080'; g.fillRect(8,8,350,22); g.fillStyle = 'white'; g.font = '16px sans-serif';
        g.fillText('Graphics',16,25); g.fillStyle = '#008000'; g.fillRect(210,330,68,22);
        g.fillStyle = 'white'; g.fillText('OK',232,347);
        const messages = [], wine = {instance: {exports: {send_message(hwnd, msg, sc) {
          messages.push({hwnd,msg,sc}); renderer.showWindow(hwnd,3);
        }}}};
        const base = {hwnd:65537,wasm:wine.instance,visible:true,isChild:false,isDialog:false,
          style:0xcf0000,x:0,y:0,w:400,h:300,zOrder:1,_backCanvas:blank};
        const dialog = {hwnd:65538,wasm:wine.instance,visible:true,isChild:false,isDialog:true,
          ownerHwnd:0,style:0x90c800c4,x:196,y:6,w:366,h:373,zOrder:2,_backCanvas:sheet};
        renderer.windows = {65537:base,65538:dialog}; renderer._nextZ = 3;
        renderer.drawWindow = () => {}; // Surfaces are already painted.
        renderer.invalidate = () => {}; renderer.scheduleRepaint = () => {};
        renderer.singleAppMode = true;
        let tick, active = true;
        const make = new Function('SINGLE_APP','sharedRenderer','runningApps','WS_MAXIMIZEBOX',
          'WS_THICKFRAME','setInterval','clearInterval','appendDebugLog', body + ';return maximizeForSingleApp;');
        const maximize = make(()=>true,renderer,[{wine}],0x10000,0x40000,
          f=>{tick=f;return 1;},()=>{active=false;},()=>{});
        maximize(wine); if(active) tick(); renderer._repaintOnce();
        const pixel = [...canvas.getContext('2d').getImageData(440,347,1,1).data];
        return {messages,pixel,dialogStillVisible:dialog.visible,top:renderer._presentationStack(
          Object.values(renderer.windows)).top.hwnd,viewport:[innerWidth,innerHeight],
          gpuContexts:0,gameStarted:false};
      }, maximizeSource(shell));
      await page.screenshot({path: path.join(out, label + '.png')});
    }
    assert.deepEqual(results.before.pixel, [192,192,192,255]);
    assert.equal(results.before.top,65537); assert.equal(results.before.messages.length,1);
    assert.deepEqual(results.after.pixel, [0,128,0,255]);
    assert.equal(results.after.top,65538); assert.equal(results.after.messages.length,0);
    fs.writeFileSync(path.join(out,'chrome-fixture.json'),JSON.stringify({passed:true,...results},null,2));
    console.log(JSON.stringify({chromePassed:true,...results}));
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(out,'fixture-browser-exit.json'),JSON.stringify({pid:browser.process().pid,
      exitCode:browser.process().exitCode,signal:browser.process().signalCode}));
  }
}

if (require.main === module) {
  console.log(JSON.stringify(unit(fs.readFileSync(path.join(root, 'lib/browser-shell.js'), 'utf8'))));
  if (process.argv[2] === '--chrome') chromeFixture(path.resolve(process.argv[3])).catch(e=>{console.error(e);process.exitCode=1;});
}
module.exports = { maximizeSource, unit };
