'use strict';
// Narrow transformation of the published original natural driver. No launch on import.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const BASELINE_SHA = 'fcfe9b91543e28046fe098b703458ea820471d6757e9280881224b0c6753bb21';
const OPTIONAL = Object.freeze([
  'lib/deusex-startup-cache-observer.js', 'lib/deusex-inline-eviction-observer.js',
  'lib/deusex-softdrv-cache-observer.js', 'lib/deusex-cache-loader-binding.js',
]);

// Serialized into the actual page before launchApp creates its first Worker.
function installFirstInit() {
  if (globalThis.__deusexCacheInit) throw Error('cache init interceptor already installed');
  const Native = globalThis.Worker;
  const state = globalThis.__deusexCacheInit = { installed: true, owningInits: 0, commands: [], responses: [] };
  globalThis.Worker = class extends Native {
    constructor(url, options) {
      super(url, options);
      if (!new URL(String(url), location.href).pathname.endsWith('/guest-worker.js')) return;
      const original = this.postMessage;
      this.postMessage = function(message, ...rest) {
        if (message?.t === 'init' && message.slot === 0) {
          if (state.owningInits || Object.hasOwn(message, 'cacheObservation')) throw Error('duplicate or preconfigured owning init');
          message.cacheObservation = { limits: { maxBoundaries: 1000000, maxRecords: 256, maxMs: 10000 } };
          state.owningInits++;
          state.commands.push({ t: message.t, seq: message.seq ?? null, slot: message.slot,
            endpointIdentity: message.endpointIdentity, beforePost: true, option: message.cacheObservation });
        }
        if (message?.t === 'cacheObservation') {
          if (state.commands.length >= 32) throw Error('cache command evidence cap');
          state.commands.push({ t: message.t, action: message.action, seq: message.seq });
        }
        return Reflect.apply(original, this, [message, ...rest]);
      };
      this.addEventListener('message', event => {
        if (event.data?.t === 'cacheObservationResult') {
          if (state.responses.length >= 16) throw Error('cache response evidence cap');
          // The original transport receives this same response without modification.
          state.responses.push(event.data);
        }
      });
    }
  };
  return { installed: true, owningInits: state.owningInits };
}

// Use the existing queued transport, retaining its seq allocation and response.
async function cacheCommand(action) {
  if (!['status', 'stop'].includes(action)) throw Error('invalid cache collection action');
  const state = globalThis.__deusexCacheInit;
  if (!state || state.owningInits !== 1) throw Error('first owning init not intercepted exactly once');
  const link = globalThis.wine?.guestWorker?.link;
  if (!link || link.slot !== 0 || typeof link._ask !== 'function') throw Error('owning queued link absent');
  const response = await link._ask({ t: 'cacheObservation', action });
  if (response.t !== 'cacheObservationResult' || !response.result) throw Error('cache binding response absent');
  const sent = state.commands.find(c => c.t === 'cacheObservation' && c.seq === response.seq && c.action === action);
  if (!sent) throw Error('cache command response identity mismatch');
  return { response, init: state.commands[0], owningInits: state.owningInits };
}

function transform(source) {
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'), BASELINE_SHA, 'published actual driver SHA');
  function replace(before, after) {
    assert.equal(source.split(before).length, 2, 'unique integration anchor: ' + before);
    source = source.replace(before, after);
  }
  replace("const prepared=require('./input-preflight.cjs').prepare(process.cwd(),process.env.DEUSEX_OUTPUT);",
    "const prepared=require('./input-preflight.cjs').prepare(process.cwd(),process.env.DEUSEX_OUTPUT);\nconst {installFirstInit,cacheCommand}=require('./natural-bound-integration.cjs');");
  replace("guard();await page.click('button[onclick=\"launchApp()\"]');",
    "guard();write('cache-init-installed.json',await page.evaluate(installFirstInit));await page.click('button[onclick=\"launchApp()\"]');");
  replace("write('readiness-met.json',latest);", "write('readiness-met.json',latest);\n write('cache-at-readiness.json',await bounded(page.evaluate(cacheCommand,'status'),5000));");
  replace("const result=await collect(page,{guard,record:(name,value)=>append(name,value)});",
    "const result=await collect(page,{guard,record:(name,value)=>append(name,value)});\n write('cache-after-draw.json',await bounded(page.evaluate(cacheCommand,'status'),5000));");
  replace("finally{if(started&&page)", "finally{if(page)try{write('cache-final-stop.json',await bounded(page.evaluate(cacheCommand,'stop'),5000));}catch(e){write('cache-final-stop-error.json',{error:String(e)});}if(started&&page)");
  return source;
}
function generate(baseline, destination) {
  const source = fs.readFileSync(baseline, 'utf8');
  fs.writeFileSync(destination, transform(source));
}
module.exports = { BASELINE_SHA, OPTIONAL, installFirstInit, cacheCommand, transform, generate };
if (require.main === module) {
  assert.equal(process.argv.length, 4, 'usage: node tools/deusex-natural-bound-cache-driver.cjs BASELINE DESTINATION');
  generate(process.argv[2], process.argv[3]);
}
