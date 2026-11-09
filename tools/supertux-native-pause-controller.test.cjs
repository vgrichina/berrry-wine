'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const zlib = require('node:zlib');
const {once} = require('node:events');
const {create, MAX_AGE_MS} = require('./supertux-native-pause-controller.cjs');

async function main() {
  const run = path.resolve(process.env.PAUSE_CONTROLLER_RUN ||
    'scratch/runs/20261108-supertux-native-pause-controller-2251');
  const driver = require('../scratch/runs/20261108-supertux-native-pause-controller-2251/driver.cjs');
  const children = [], controls = [];
  const fixtureRoot = path.join(run, 'fixtures-' + process.pid); fs.mkdirSync(fixtureRoot);
  // The invoking timeout is independent of this Node owner. This local cap also
  // precedes all children, which have their own finite lifetime before IPC.
  const cap = setTimeout(() => { for (const child of children) child.kill('SIGKILL'); }, 45000);
  console.log(JSON.stringify({kind: 'prearmed-fixture-watchdog', ms: 45000, noGame: true}));
  let caseNumber = 0;
  async function fixture(options = {}) {
    const child = cp.spawn(process.execPath, ['-e', `
      const cap=setTimeout(()=>process.exit(99),30000);
      process.on('message',m=>{
        if(m.quit){clearTimeout(cap);process.disconnect();return;}
        process.send({event:m.params,id:m.id,at:Date.now()});
        setTimeout(()=>process.send({ack:m.id,reject:m.reject,at:Date.now()}),m.delay);
      });
    `], {stdio: ['ignore', 'pipe', 'pipe', 'ipc']});
    children.push(child); child.wait = once(child, 'close');
    child.stdout.resume(); child.stderr.resume();
    let next = 0, current, completed = [], events = [], changed = false;
    const requests = new Map(), rows = [];
    const binding = driver.binding;
    const moduleBytes = Buffer.from('offline module fixture only');
    const moduleSha = binding.sha(moduleBytes);
    const app = {name: 'supertux_013', running: true, stopped: false, guestWorker: true,
      processId: 1, processObject: 'process', endpoint: 'endpoint', endpointObject: 'link',
      workerObject: 'worker', moduleObject: 'module', epoch: 'document',
      renderEndpoint: 'none', renderEndpointObject: 'none', renderWorkerObject: 'none',
      pageRendererObject: 'renderer', canvasObject: 'canvas', guestEndpoint: 'endpoint', slot: 1};
    const workers = new Map([['worker', {url: 'guest-worker', sessionId: 'worker', targetId: 'target',
      scripts: [{scriptId: 'script', bytecodeAvailable: true, sha256: moduleSha}]}]]);
    const send = (method, params, session) => {
      if (method === 'Debugger.getScriptSource') return Promise.resolve({bytecode: moduleBytes.toString('base64')});
      if (method === 'Page.captureScreenshot') return Promise.resolve({data: Buffer.from('fixture pixels').toString('base64')});
      assert.equal(method, 'Input.dispatchKeyEvent'); assert.equal(session, 'page');
      const id = ++next;
      const actionDown = params.code === 'ArrowRight' && params.type === 'keyDown';
      const delay = actionDown ? options.delay || 0 : options.resumeDelay && params.code === 'Escape' && params.type === 'keyDown' ? options.resumeDelay : options.upDelay && params.code === 'ArrowRight' && params.type === 'keyUp' ? options.upDelay : 0;
      const promise = new Promise((resolve, reject) => requests.set(id, {resolve, reject}));
      child.send({id, params, delay, reject: options.reject && actionDown});
      return promise;
    };
    const chain = binding.createChain({send, workers, pageSession: 'page', app: 'supertux_013',
      expectedModules: [moduleSha], evaluate: async expression => {
        if (expression === binding.PAGE_READ) return {isolated: true, apps: [{...app}]};
        if (expression === binding.WORKER_READ) return {endpointIdentity: 'endpoint', slot: 1, instance: 'instance'};
        throw Error('unexpected passive expression');
      }});
    const shot = await chain.capture('scene-' + ++caseNumber);
    if (options.age !== undefined) shot.capture.at = new Date(Date.now() - options.age).toISOString();
    // For stale controls use the actual chain clock/capture, not only a forged review.
    const originalAdmit = chain.admit;
    if (options.age !== undefined) chain.admit = (review, dispatch) => originalAdmit(review,
      admission => dispatch({...admission, capture: {...admission.capture, at: shot.capture.at}}));
    const review = {...shot.capture, review: 'offline fixture reviewed; no native Pause proof'};
    const observation = {...shot.capture, nativePaused: true, grounded: true, review: 'fixture observation only'};
    if (options.neutral) Object.assign(observation, {grounded: false, airborne: true});
    if (options.badGround) observation.grounded = false;
    if (options.observation === 'missing') delete observation.nativePaused;
    if (options.observation === 'missing-at') delete observation.at;
    if (options.observation === 'unpaused') observation.nativePaused = false;
    const dir = path.join(fixtureRoot, 'fixture-' + caseNumber); fs.mkdirSync(dir); fs.mkdirSync(path.join(dir, 'commands'));
    const consumer = driver.createConsumer({chain, send, session: 'page', identity: shot.capture.identity,
      deadline: Date.now() + (options.deadlineMs || 20000), ackMs: options.ackMs || 250, save: row => rows.push(row)});
    current = consumer.controller;
    child.on('message', message => {
      if (message.event) {
        events.push(message);
        if (options.cancel && message.event.code === 'ArrowRight' && message.event.type === 'keyDown') current.cancel();
        if (options.cancelResume && message.event.code === 'Escape' && message.event.type === 'keyDown') current.cancel();
      } else {
        completed.push(message);
        if (options.replace && !changed && events.some(e => e.id === message.ack && e.event.code === 'Escape' && e.event.type === 'keyUp')) {
          app[options.replace] += '-replaced'; changed = true;
        }
        const request = requests.get(message.ack); requests.delete(message.ack);
        message.reject ? request.reject(Error('Node owner rejected actual command')) : request.resolve(message);
        if (options.cancelNeutral && events.some(e => e.id === message.ack && e.event.code === 'Escape' && e.event.type === 'keyUp'))
          setTimeout(() => current.cancel(), 50);
      }
    });
    const command = {id: 'command-' + caseNumber, action: 'pause-step', review, observation,
      keys: ['ArrowRight'], holdMs: options.holdMs || 100};
    if (options.neutral) Object.assign(command, {kind: 'neutral-settle', keys: [], holdMs: 200});
    if (options.override) Object.assign(command, options.override);
    async function consume(number, commandValue = command) {
      fs.writeFileSync(path.join(dir, 'commands', number + '.json.gz'), zlib.gzipSync(JSON.stringify(commandValue)), {flag: 'wx'});
      return consumer.consume(dir, number);
    }
    async function finish() {
      await current.settle(); await driver.input.drain();
      assert.equal(current.pending.length, 0); assert.equal(requests.size, 0);
      child.send({quit: true}); await child.wait;
      fs.writeFileSync(path.join(dir, 'observations.json.gz'), zlib.gzipSync(JSON.stringify({events, completed, rows,
        commands: current.commands.map(({promise, ...row}) => row), state: current.state})));
    }
    return {consumer, current, command, consume, finish, events, completed, rows, dir};
  }
  try {
    assert.equal(MAX_AGE_MS, 12000);
    const neutral = await fixture({neutral: true});
    await neutral.consume(0);
    assert.deepEqual(neutral.events.map(e => [e.event.code, e.event.type]), [
      ['Escape', 'keyDown'], ['Escape', 'keyUp'], ['Escape', 'keyDown'], ['Escape', 'keyUp']]);
    assert(neutral.events[2].at - neutral.completed.find(e => e.ack === neutral.events[1].id).at >= 200);
    assert.equal(neutral.current.state.grounded, 'UNKNOWN');
    await assert.rejects(neutral.current.run({...neutral.command, id: 'replay-settle'}), /already used/);
    await neutral.finish(); controls.push('explicit airborne neutral 200ms, only resume/pause Escape, no inferred landing, replay rejected');
    for (const options of [
      {override: {keys: []}}, {badGround: true},
      {neutral: true, override: {holdMs: 201}}, {neutral: true, override: {keys: ['Space']}},
      {neutral: true, override: {observation: {nativePaused: true, grounded: false}}},
      {neutral: true, age: 12001}, {neutral: true, age: -1000},
      {neutral: true, replace: 'workerObject'}, {neutral: true, replace: 'moduleObject'},
      {neutral: true, cancelResume: true, resumeDelay: 180}, {neutral: true, resumeDelay: 450, ackMs: 120},
      {neutral: true, cancelNeutral: true}, {neutral: true, deadlineMs: 1000}
    ]) {
      const f = await fixture(options); await assert.rejects(f.consume(0));
      assert(f.current.closed); await f.finish();
      assert(f.events.every(e => e.event.code === 'Escape'));
      assert(f.events.filter(e => e.event.type === 'keyDown').length <= 1);
      controls.push('neutral/ordinary boundary sticky UNKNOWN ' + JSON.stringify(options));
    }
    for (const holdMs of [100, 200]) {
      const f = await fixture({holdMs, delay: holdMs + 80, ackMs: 400});
      const running = f.consume(0);
      while (!f.events.some(e => e.event.code === 'ArrowRight' && e.event.type === 'keyUp')) await new Promise(r => setTimeout(r, 5));
      assert(f.current.pending.length > 0, 'DOWN remains genuinely pending while independent UP arrives');
      assert(f.current.pending.every(p => p instanceof Promise));
      await running;
      assert.deepEqual(f.events.map(e => [e.event.code, e.event.type]), [
        ['Escape', 'keyDown'], ['Escape', 'keyUp'], ['ArrowRight', 'keyDown'],
        ['ArrowRight', 'keyUp'], ['Escape', 'keyDown'], ['Escape', 'keyUp']]);
      const cmds = f.current.commands;
      assert(cmds[2].completedAt <= cmds[4].commandAt && cmds[3].completedAt <= cmds[4].commandAt);
      assert(cmds[0].commandAt < cmds[1].commandAt);
      assert.equal(f.current.state.nativePaused, 'UNKNOWN'); assert.equal(f.current.state.grounded, 'UNKNOWN');
      await assert.rejects(f.current.run({...f.command, id: 'same-capture-new-id'}), /already used/);
      await f.finish(); controls.push('fresh paused composition ' + holdMs + 'ms; actual pending DOWN independent UP; genuine ordering; no observation inferred; capture no replay');
    }
    for (const options of [{delay: 450, ackMs: 120}, {reject: true}, {upDelay: 450, ackMs: 120}, {cancel: true, delay: 180}]) {
      const f = await fixture(options);
      await assert.rejects(f.consume(0));
      assert(f.current.closed);
      const count = f.events.length;
      await assert.rejects(f.current.run({...f.command, id: 'forbidden'}));
      await assert.rejects(f.consume(1, {...f.command, id: 'forbidden-transport'}));
      await f.finish(); assert.equal(f.events.length, count);
      assert.equal(f.events.filter(e => e.event.code === 'Escape' && e.event.type === 'keyDown').length, 1, 'no final Pause DOWN after uncertain action');
      assert(f.events.some(e => e.event.code === 'ArrowRight' && e.event.type === 'keyUp'));
      controls.push('actual transport sticky failure ' + JSON.stringify(options));
    }
    for (const options of [{age: 12001}, {observation: 'missing'}, {age: -1000}, {replace: 'workerObject'}, {replace: 'moduleObject'}]) {
      const f = await fixture(options); await assert.rejects(f.consume(0));
      assert(f.current.closed);
      assert(!f.events.some(e => e.event.code === 'ArrowRight'));
      await f.finish(); controls.push('observation/owner admission ' + JSON.stringify(options));
    }
    for (const options of [{resumeDelay: 450, ackMs: 120}, {cancelResume: true, resumeDelay: 180},
      {observation: 'missing-at'}, {observation: 'unpaused'}]) {
      const f = await fixture(options); await assert.rejects(f.consume(0));
      await f.finish(); assert(f.current.closed);
      assert(!f.events.some(e => e.event.code === 'ArrowRight'));
      assert(f.events.filter(e => e.event.type === 'keyDown').length <= 1);
      controls.push('no action after uncertain resume/missing supporting observation ' + JSON.stringify(options));
    }
    // Cancellation before admission permits zero new DOWN or UP.
    const f = await fixture(); f.current.cancel(); await assert.rejects(f.consume(0));
    await f.finish(); assert.equal(f.events.length, 0); controls.push('pre-cancel zero commands');
    console.log(JSON.stringify({passed: true, controls, actualNodeOwnerChildren: children.length,
      actualTransportConsumer: true, gamePauseOrNodeClearProven: false, boxes: 'NONE'}));
  } finally {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await Promise.all(children.map(child => child.wait)); clearTimeout(cap);
  }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
