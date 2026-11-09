'use strict';
// Explicit relative-count caller for the retained Q3 controller. This is input,
// through the same renderer entry point as Pointer Lock, never a UI-state write.
const assert = require('node:assert/strict');
const path = require('node:path');
const native = require('../scratch/runs/20261108-q3-gl-readiness-gameplay/native-mouse.cjs');

function relativeInput(counts) {
  const canvas = document.getElementById('screen');
  const apps = runningApps.filter(a => a.wine?.running !== false);
  if (apps.length !== 1 || apps[0].name !== 'quake3_demo') throw Error('one admitted original Q3 required');
  const renderer = apps[0].wine.renderer;
  if ((document.pointerLockElement || document.webkitPointerLockElement) !== canvas)
    throw Error('relative click requires existing canvas Pointer Lock');
  if (renderer.canvas !== canvas || typeof renderer.handleRelativeMouseMove !== 'function' || renderer._mouseButtonsMask)
    throw Error('owning canvas renderer with released buttons required');
  renderer.handleRelativeMouseMove(counts[0], counts[1], {guestCounts:true});
  return {route:'renderer.handleRelativeMouseMove', counts, application:'UNKNOWN'};
}

async function perform({send, evaluate, session, geometry:g, command:c, onFailure=()=>{}}) {
  if (c.relativeCounts === undefined) return native.perform({send, session, geometry:g, command:c});
  native.validate(c);
  assert.equal(c.action, 'click', 'relative correction is one ordinary click');
  assert(c.relativeCounts?.length === 2 && c.relativeCounts.every(Number.isInteger) &&
    Math.abs(c.relativeCounts[0]) <= 640 && Math.abs(c.relativeCounts[1]) <= 480 &&
    c.relativeCounts.some(v => v !== 0), 'bounded explicit relative counts');
  assert([g.left,g.top,g.width,g.height].every(Number.isFinite) && g.width > 0 && g.height > 0);
  const motion = await evaluate(`(${relativeInput.toString()})(${JSON.stringify(c.relativeCounts)})`);
  assert.equal(motion?.route, 'renderer.handleRelativeMouseMove');
  const position = {x:g.left+g.width*c.point[0], y:g.top+g.height*c.point[1]};
  const holdMs = c.holdMs ?? 150, events = [];
  let releasePromise, failure, downCompleted = false, rejectBound, waitTimer;
  const bound = new Promise((_, reject) => { rejectBound = reject; });
  bound.catch(()=>{});
  const receipt = {action:'click', motion, position, holdMs, events,
    independentRelease:true, route:'production relative counts then native CDP buttons', application:'UNKNOWN'};
  function dispatch(type, buttons) {
    const row = {type, at:Date.now()}; events.push(row);
    try {
      return Promise.resolve(send('Input.dispatchMouseEvent',
        {type,...position,button:'left',buttons,clickCount:1},session)).then(value => {
          row.reply = {ok:true,at:Date.now()}; return value;
        }, error => {row.reply = {ok:false,error:String(error)}; throw error;});
    } catch (error) {row.reply = {ok:false,error:String(error)}; return Promise.reject(error);}
  }
  function release() {
    if (releasePromise) return releasePromise;
    receipt.releaseAt = Date.now();
    // Reserve before invoking send, including synchronous failures/reentry.
    let resolve, reject;
    releasePromise = new Promise((a,b) => {resolve=a; reject=b;});
    releasePromise.catch(()=>{});
    dispatch('mouseReleased',0).then(resolve,reject);
    return releasePromise;
  }
  function fail(error) {
    if (failure) return;
    failure = error;
    receipt.firstFailure = String(error);
    release(); // Independent UP is submitted before terminal admission closes.
    rejectBound(error);
    onFailure(error);
  }
  receipt.started = Date.now();
  const timer = setTimeout(() => {
    release().catch(fail);
    if (!downCompleted) fail(Error('mouse delivery exceeded hold bound; DOWN reply UNKNOWN'));
  },holdMs);
  try {
    await Promise.race([dispatch('mousePressed',1),bound]);
    downCompleted = true;
    assert(!releasePromise,'mouse delivery exceeded hold bound');
    await Promise.race([new Promise(resolve => {
      // This wait shares the original DOWN origin; it does not extend the hold.
      waitTimer = setTimeout(resolve,Math.max(0,holdMs-(Date.now()-receipt.started)));
    }),bound]);
  } catch (error) {fail(error);}
  finally {
    clearTimeout(timer); clearTimeout(waitTimer);
    try {await release();} catch (error) {fail(error);}
  }
  receipt.ok = !failure;
  if (failure) {failure.mouseReceipt = receipt; throw failure;}
  return receipt;
}

function integrate(source) {
  return require('./q3-native-driver-composition.cjs').replaceOnce(source,
    "require('./native-mouse.cjs').perform({send,session:pageSession,geometry,command:c})",
    "require(root+'/tools/q3-menu-pointer-control.cjs').perform({send,evaluate,session:pageSession,geometry,command:c,onFailure:observeTerminal})");
}
function install() {
  const Module = require('node:module');
  const composition = require('./q3-native-driver-composition.cjs');
  const consumer = path.resolve(__dirname,'..',composition.consumerPath);
  assert.equal(path.resolve(process.argv[1] || ''),consumer);
  assert.equal(process.env.Q3_NATIVE_COMPOSITION,'1');
  const previous = Module._extensions['.cjs'];
  Module._extensions['.cjs'] = function(module,filename) {
    if (filename !== consumer) return previous(module,filename);
    const compile = module._compile;
    module._compile = function(source,name) {return compile.call(this,integrate(source),name);};
    try {return previous(module,filename);} finally {module._compile = compile;}
  };
}
module.exports = {perform, relativeInput, integrate};
if (process.env.Q3_MENU_POINTER_CONTROL === '1') install();
