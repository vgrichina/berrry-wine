#!/usr/bin/env node
'use strict';
// Source-only independent review. No compilation, VM, browser, or production edits.
const fs = require('node:fs'), cp = require('node:child_process');
const path = require('node:path'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ref = 'a4e1100b0cf9b1e4d3037dccc73c286f20e1751c';
const git = (...a) => cp.execFileSync('git', ['-c','push.autoSetupRemote=false',
  '-c','branch.autoSetupMerge=false','-C',root,...a], {encoding:'utf8',maxBuffer:32*1024*1024}).trimEnd();
const raw = p => cp.execFileSync('git',['-C',root,'show',`${ref}:${p}`],{maxBuffer:32*1024*1024});
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const {scanSources,check} = require(path.join(root,'tools/callback-ownership-census'));
const files = git('ls-tree','-r','--name-only',ref).split('\n')
  .filter(f => /^src\/[^/]+\.watx?$/.test(f) || /^[^/]+\.js$/.test(f) || /^lib\/.*\.js$/.test(f));
const sources = files.map(file => ({file,src:raw(file).toString()}));
const census = JSON.parse(raw('tools/callback-ownership-census.json'));
const entries = scanSources(sources);
assert.deepEqual(check(entries,census),[]);
const controls = [];
function mutate(label,file,before,after,expected,refresh=false) {
  const source = sources.find(s=>s.file===file);
  assert.equal(source.src.split(before).length,2,label+' unique anchor');
  const changed = scanSources(sources.map(s=>s===source?{file,src:s.src.replace(before,after)}:s));
  const declaration = structuredClone(census);
  if(refresh) for(const e of declaration.entries) {
    const actual=changed.find(a=>a.file===e.file && a.name===e.name);
    if(actual)e.sha256=actual.sha256;
  }
  const errors=check(changed,declaration);
  assert.equal(errors.length===0,expected,label);
  controls.push({label,file,before,after,refresh,gate:errors.length?'REJECT':'PASS',errors});
}
mutate('28-byte MSG reduced to four bytes','src/09ca-screensavers.wat',
  '(global.set $scrsave_msg (call $heap_alloc (i32.const 28)))',
  '(global.set $scrsave_msg (call $heap_alloc (i32.const 4)))',false);
mutate('same undersized MSG with refreshed digest','src/09ca-screensavers.wat',
  '(global.set $scrsave_msg (call $heap_alloc (i32.const 28)))',
  '(global.set $scrsave_msg (call $heap_alloc (i32.const 4)))',true,true);
mutate('unexported Close leaks MSG','src/09ca-screensavers.wat',
  '(call $heap_free (global.get $scrsave_msg))','(nop)',true);
mutate('unexported Preview drops shell launch','src/09ca-screensavers.wat',
  '(call $host_shell_execute','(call $unreviewed_shell_execute',true);
mutate('shell cancellation checkpoint removed','lib/browser-shell.js',
  'await wine.loadWatApp(app.watApp);\n        throwIfCancelled(ctx);',
  'await wine.loadWatApp(app.watApp);\n        void ctx;',false);
mutate('same missing cancellation checkpoint with refreshed digest','lib/browser-shell.js',
  'await wine.loadWatApp(app.watApp);\n        throwIfCancelled(ctx);',
  'await wine.loadWatApp(app.watApp);\n        void ctx;',true,true);
const falseReason=structuredClone(census);
falseReason.entries.find(e=>e.name==='$scrsave_pump').reason='All allocations, callbacks and browser lifetimes proven safe.';
assert.deepEqual(check(entries,falseReason),[]);
controls.push({label:'false prose is not semantically validated',gate:'PASS'});
const text = p => sources.find(s=>s.file===p).src;
const app = text('src/09ca-screensavers.wat');
const helpers = text('src/10-helpers.wat');
assert(app.indexOf('(drop (call $paint_drain_native_control_paints))') <
  app.indexOf('(block $paints (loop $paint'));
const drain=helpers.slice(helpers.indexOf('(func $paint_drain_native_control_paints'),
  helpers.indexOf('(func $paint_next_child_slot'));
assert(drain.includes('(br_if $done (i32.ge_u (local.get $guard) (global.get $MAX_WINDOWS)))'));
assert(drain.includes('(drop (call $control_wndproc_dispatch'));
assert(text('src/01-header.wat').includes('(global $MAX_WINDOWS   i32 (i32.const 256))'));
const windowText=text('src/09a5-handlers-window.wat');
const activation=windowText.slice(windowText.indexOf('(func $message_mouse_activate32'),
  windowText.indexOf('(func $incoming_send_yield'));
assert(activation.indexOf('(call $wnd_send_message') < activation.indexOf('(call $gs32 (local.get $ptr)'));
assert(activation.includes('(call $gs32 (i32.add (local.get $ptr) (i32.const 24))'));
const before = JSON.parse(git('show',`${ref}^:tools/callback-ownership-census.json`));
const changed=census.entries.filter(e => JSON.stringify(e)!==JSON.stringify(
  before.entries.find(b=>b.file===e.file&&b.name===e.name)));
assert.equal(changed.length,6);
assert(changed.every(e=>e.ownership==='pending'));
const inspected = ['host.js','lib/apps.js','lib/browser-shell.js','src/09ca-screensavers.wat',
  'src/09c3-controls.wat','src/09c3a-dialog-runtime.wat','src/09a5-handlers-window.wat',
  'src/10-helpers.wat','src/01-header.wat','tools/callback-ownership-census.js',
  'tools/callback-ownership-census.json','tools/screensaver-ownership-census.test.js',
  'test/test-callback-ownership-census.js','test/test-screensaver-applet.js',
  'test/test-screensaver-input.js','test/test-screensaver-wiring.js'];
console.log(JSON.stringify({ref,tree:git('rev-parse',`${ref}^{tree}`),sources:files.length,
  entries:entries.length,changed:changed.map(e=>({file:e.file,name:e.name,sha256:e.sha256,ownership:e.ownership})),
  controls,sourceFindings:{nativeDrainLimit:256,finalDirtyLoopLimit:32,
    activationRestoresOriginalPointerAfterCallback:true},
  identities:inspected.map(file=>({file,blob:git('rev-parse',`${ref}:${file}`),sha256:hash(raw(file))})),
  scope:'source assertions and mutation controls only; no runtime safety qualification'},null,2));
