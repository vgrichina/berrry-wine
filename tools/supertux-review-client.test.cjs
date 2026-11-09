'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const z = require('node:zlib');
const {once} = require('node:events');
const {createClient, serve, choices} = require('./supertux-review-client.cjs');
const root = path.resolve(__dirname, '..');
const retained = require('../scratch/runs/20261108-supertux-native-pause-controller-2251/driver.cjs');
const storage = require('../scratch/runs/20261108-supertux-controller-visible-progress-2301/json-storage.cjs');
const save = (p, value) => fs.writeFileSync(p, z.gzipSync(JSON.stringify(value)), {flag: 'wx'});

async function fixture() {
  const out = process.argv[3]; storage.install(out);
  const deadline = Date.now() + 20000;
  const cap = setTimeout(() => process.exit(99), 24000);
  let next = 0, quit = false, changed = false;
  const pending = new Map();
  const bytes = Buffer.from('offline pixels; no native game proof');
  const moduleBytes = Buffer.from('offline module');
  const binding = retained.binding;
  const moduleSha = binding.sha(moduleBytes);
  const app = {name: 'supertux_013', running: true, stopped: false, guestWorker: true,
    processId: 1, processObject: 'process', endpoint: 'endpoint', endpointObject: 'link',
    workerObject: 'worker', moduleObject: 'module', epoch: 'document',
    renderEndpoint: 'none', renderEndpointObject: 'none', renderWorkerObject: 'none',
    pageRendererObject: 'renderer', canvasObject: 'canvas', guestEndpoint: 'endpoint', slot: 1};
  const workers = new Map([['worker', {url: 'guest-worker', sessionId: 'worker', targetId: 'target',
    scripts: [{scriptId: 'script', bytecodeAvailable: true, sha256: moduleSha}]}]]);
  const send = (method, params) => {
    if (method === 'Debugger.getScriptSource') return Promise.resolve({bytecode: moduleBytes.toString('base64')});
    if (method === 'Page.captureScreenshot') return Promise.resolve({data: bytes.toString('base64')});
    assert.equal(method, 'Input.dispatchKeyEvent');
    const id = ++next;
    return new Promise((resolve, reject) => { pending.set(id, {resolve, reject}); process.send({event: params, id, at: Date.now()}); });
  };
  process.on('message', message => {
    if (message.quit) { quit = true; return; }
    if (message.change) { changed = true; process.send({changed: true}); return; }
    const entry = pending.get(message.ack); pending.delete(message.ack); entry.resolve();
  });
  const chain = binding.createChain({send, workers, pageSession: 'page', app: 'supertux_013', expectedModules: [moduleSha],
    evaluate: async expression => {
      if (expression === binding.PAGE_READ) return {isolated: true, apps: [{...app, workerObject: changed ? 'replaced' : 'worker'}]};
      if (expression === binding.WORKER_READ) return {endpointIdentity: 'endpoint', slot: 1, instance: 'instance'};
      throw Error('unexpected read');
    }});
  // Execute the actual composed production command function, without its
  // browser startup IIFE. Providers are hash checked by compose; input goes
  // through the same numbered consumer and real Node owner below.
  const integrated = require('./supertux-native-driver-composition.cjs').compose({root,
    manifest: JSON.parse(z.gunzipSync(fs.readFileSync(process.env.COMPOSITION_MANIFEST)))});
  const begin = integrated.source.indexOf('async function execute(c,markDispatch){');
  const end = integrated.source.indexOf('\n(async()=>{', begin);
  assert(begin > 0 && end > begin);
  let latest;
  const capture = async label => {
    const shot = await chain.capture(label); latest = shot.capture;
    fs.writeFileSync(path.join(out, label + '.png'), shot.png, {flag: 'wx'});
    fs.writeFileSync(path.join(out, label + '-capture.json'), JSON.stringify(shot.capture));
    fs.writeFileSync(path.join(out, 'latest.json'), JSON.stringify(shot.capture));
  };
  const productionRequire = name => name === './input.cjs' ? retained.input : require(name);
  const driver = new Function('assert', 'fs', 'out', 'root', 'require', 'chain', 'send', 'pageSession', 'deadline',
    'bound', 'log', 'wait', 'capture', 'getLatest', 'sha', `const session={check:()=>{}};let pauseCommandId,pauseController;
    ${integrated.source.slice(begin, end).replace('assert(latest&&c.reviewRef===latest.label);', 'const latest=getLatest();assert(latest&&c.reviewRef===latest.label);')}
    return {execute,get controller(){return pauseController;}};`)(assert, fs, out, root, productionRequire, chain,
      send, 'page', deadline, binding, (name, row) => process.send({receipt: row}),
      ms => new Promise(r => setTimeout(r, ms)), capture, () => latest, binding.sha);
  let n = 0;
  fs.writeFileSync(path.join(out, 'ready.json'), JSON.stringify({ready: true, deadline}));
  process.send({ready: true, deadline});
  try {
    while (!quit) {
      const consumed = await retained.transport.consume(out, n, async (command, markDispatch) => {
        await driver.execute(command, markDispatch);
      });
      if (consumed) n++; else await new Promise(r => setTimeout(r, 5));
    }
  } catch (error) { process.send({terminalError: String(error)}); }
  finally {
    await driver.controller?.settle(); await retained.input.drain();
    console.log(JSON.stringify({closed: driver.controller?.closed, pending: pending.size, physical: retained.input.physical.size}));
    clearTimeout(cap); process.disconnect();
  }
}

async function main() {
  const run = path.resolve(process.env.REVIEW_CLIENT_RUN);
  fs.mkdirSync(run, {recursive: true});
  const restore = storage.install(run);
  const children = [], receipts = [], controls = [];
  const cap = setTimeout(() => { for (const c of children) c.kill('SIGKILL'); }, 60000);
  console.log(JSON.stringify({prearmedFixtureWatchdogMs: 60000, outerTimeoutRequired: true, boxes: 'NONE'}));
  let serial = 0;
  async function start({delay = 160} = {}) {
    const out = path.join(run, 'fixture-' + process.pid + '-' + ++serial);
    fs.mkdirSync(out); fs.mkdirSync(path.join(out, 'commands'));
    const child = cp.spawn(process.execPath, [__filename, '--fixture', out], {stdio: ['ignore', 'pipe', 'pipe', 'ipc']});
    children.push(child);
    const receipt = {pid: child.pid, start: fs.readFileSync('/proc/' + child.pid + '/stat', 'utf8').split(') ')[1].split(' ')[19],
      spawnedAt: Date.now(), stdout: '', stderr: '', stdoutEOF: false, stderrEOF: false}; receipts.push(receipt);
    const events = [], rows = []; let readyResolve;
    const ready = new Promise(r => { readyResolve = r; });
    child.on('message', m => {
      rows.push(m);
      if (m.ready) readyResolve(m);
      if (m.event) {
        events.push(m);
        setTimeout(() => { if (child.connected) { child.send({ack: m.id}); rows.push({actualAckSent: m.id, at: Date.now()}); } },
          m.event.type === 'keyDown' && m.event.code === 'ArrowRight' ? delay : 0);
      }
    });
    for (const stream of ['stdout', 'stderr']) {
      child[stream].on('data', b => { receipt[stream] += b; });
      child[stream].on('end', () => { receipt[stream + 'EOF'] = true; });
    }
    child.on('exit', (code, signal) => { receipt.exit = {code, signal, at: Date.now()}; });
    child.wait = new Promise(resolve => child.on('close', (code, signal) => { receipt.close = {code, signal, at: Date.now()}; resolve(); }));
    const {deadline} = await ready;
    // Production ACK limits remain unchanged. A failed consumer intentionally
    // publishes no success ACK; the test transport has a finite wait.
    const client = createClient({out, deadline,
      request: (dir, id, command) => retained.transport.request(dir, id, command, 3000)});
    async function finish() {
      if (child.connected) child.send({quit: true});
      await child.wait;
      assert.equal(receipt.exit.code, 0); assert.equal(receipt.close.code, 0);
      assert(receipt.stdoutEOF && receipt.stderrEOF); assert(!fs.existsSync('/proc/' + child.pid));
      save(path.join(out, 'child-receipt.json.gz'), {...receipt, events, rows});
    }
    return {out, client, child, deadline, events, rows, finish};
  }
  const choose = state => ({action: 'choose', token: state.token, choice: 'right-100', nativePaused: true, grounded: true,
    review: 'OFFLINE fixture ground and short clear rightward geometry; not gameplay qualification'});
  try {
    const f = await start();
    // Exercise the runnable CLI, pinned providers, startup lock and graceful
    // server shutdown against this live offline consumer without any capture.
    const cli = cp.spawn(process.execPath, [path.join(__dirname, 'supertux-review-client.cjs'), f.out],
      {stdio: ['ignore', 'pipe', 'pipe']});
    children.push(cli);
    const cliReceipt = {kind: 'review-cli', pid: cli.pid,
      start: fs.readFileSync('/proc/' + cli.pid + '/stat', 'utf8').split(') ')[1].split(' ')[19],
      spawnedAt: Date.now(), stdout: '', stderr: '', stdoutEOF: false, stderrEOF: false};
    receipts.push(cliReceipt);
    cli.wait = new Promise(resolve => cli.once('close', (code, signal) => { cliReceipt.close = {code, signal}; resolve(); }));
    cli.once('exit', (code, signal) => { cliReceipt.exit = {code, signal}; });
    for (const stream of ['stdout', 'stderr']) {
      cli[stream].on('data', b => { cliReceipt[stream] += b; });
      cli[stream].once('end', () => { cliReceipt[stream + 'EOF'] = true; });
    }
    try {
      await Promise.race([once(cli.stdout, 'data'), cli.wait.then(() => { throw Error('CLI failed: ' + cliReceipt.stderr); })]);
      const cliUrl = /http:\/\/127\.0\.0\.1:\d+\/#\w+/.exec(cliReceipt.stdout)[0];
      const u = new URL(cliUrl);
      assert.equal((await fetch(u.origin + '/state', {headers: {authorization: u.hash.slice(1)}})).status, 200);
      assert.equal(fs.readdirSync(path.join(f.out, 'commands')).length, 0);
    } finally {
      cli.kill('SIGTERM'); await cli.wait;
      assert.equal(cliReceipt.exit.code, 0); assert.equal(cliReceipt.close.code, 0);
      assert(cliReceipt.stdoutEOF && cliReceipt.stderrEOF);
      assert(!fs.existsSync('/proc/' + cli.pid));
      assert(!fs.existsSync(path.join(f.out, 'review-client.lock')));
    }
    controls.push('runnable CLI pinned helpers, passive startup, normal SIGTERM wait + stdout/stderr EOF');
    const {server, token} = serve(f.client); await once(server, 'listening');
    const url = 'http://127.0.0.1:' + server.address().port;
    try {
      const page = await fetch(url + '/'); assert.equal(page.status, 200);
      const script = (await page.text()).split('<script>')[1].split('</script>')[0];
      // Run the shipped page's gating/rendering logic without a browser.
      const elements = new Map();
      const element = id => {
        if (!elements.has(id)) elements.set(id, {checked: false, value: '', dataset: {}, children: [],
          replaceChildren(){this.children = [];}, append(b){this.children.push(b);}});
        return elements.get(id);
      };
      const ui = require('node:vm').createContext({location: {hash: '#fixture'}, performance: {now: () => 0},
        document: {getElementById: element, querySelectorAll: () => element('choices').children,
          createElement: () => ({dataset: {}})}, setInterval: () => {}, fetch: () => new Promise(() => {})});
      require('node:vm').runInContext(script, ui);
      ui.sample = {now: Date.now(), runtimeDeadline: Date.now() + 20000, maxAgeMs: 12000,
        captureDeadline: Date.now() + 12000, capture: {at: new Date().toISOString()}, choices};
      require('node:vm').runInContext('render(sample,0)', ui);
      element('paused').checked = true; element('review').value = 'personally reviewed offline frame';
      element('airborne').checked = true;
      require('node:vm').runInContext('clock()', ui);
      assert.deepEqual(element('choices').children.map(b => b.disabled), [true,true,true,true,true,false]);
      element('grounded').checked = true; element('airborne').checked = false;
      require('node:vm').runInContext('clock()', ui);
      assert.deepEqual(element('choices').children.map(b => b.disabled), [false,false,false,false,false,true]);
      require('node:vm').runInContext('render(sample,0)', ui);
      assert(element('choices').children.every(b => b.disabled));
      controls.push('shipped page DOM gating: airborne settle only, grounded five ordinary choices, fresh capture clears attestations');
      assert.equal((await fetch(url + '/state', {headers: {authorization: token}})).status, 200);
      assert.equal((await fetch(url + '/command', {method: 'POST', body: '{"action":"capture"}'})).status, 403);
      assert.equal(fs.readdirSync(path.join(f.out, 'commands')).length, 0, 'GET and unauthorized POST have no command side effects');
      const response = await fetch(url + '/command', {method: 'POST', headers: {authorization: token}, body: JSON.stringify({action: 'capture'})});
      const s = await response.json(); assert.equal(response.status, 200); assert.equal(f.events.length, 0);
      assert.equal(s.captureDeadline, Date.parse(s.capture.at) + 12000);
      const action = await fetch(url + '/command', {method: 'POST', headers: {authorization: token}, body: JSON.stringify(choose(s))});
      assert.equal(action.status, 200);
      assert.deepEqual(f.events.map(e => [e.event.code, e.event.type]), [
        ['Escape', 'keyDown'], ['Escape', 'keyUp'], ['ArrowRight', 'keyDown'], ['ArrowRight', 'keyUp'], ['Escape', 'keyDown'], ['Escape', 'keyUp']]);
      const up = f.events[3], downAck = f.rows.find(r => r.actualAckSent === f.events[2].id);
      assert(up.at < downAck.at, 'independent actual UP precedes late actual DOWN ACK');
      assert(downAck.at <= f.events[4].at, 'next Pause waits for prior real completion');
      await assert.rejects(f.client.execute(choose(s)), /exact fresh capture token/);
      const count = f.events.length;
      const reopened = createClient({out: f.out, deadline: f.deadline, request: retained.transport.request});
      await assert.rejects(reopened.execute({action: 'capture'}), /UNKNOWN/);
      assert.equal(f.events.length, count);
      controls.push('real HTTP explicit choice, real numbered transport + actual controller, independent UP and prior completion, persisted replay refusal');
    } finally { await new Promise(r => server.close(r)); await f.finish(); }

    const ordinary = await start({delay: 0});
    try {
      let s = await ordinary.client.execute({action: 'capture'});
      for (const [choice, spec] of Object.entries(choices).filter(([,c]) => !c.kind)) {
        const offset = ordinary.events.length;
        s = await ordinary.client.execute({...choose(s), choice});
        const events = ordinary.events.slice(offset);
        assert.deepEqual(events.map(e => [e.event.code, e.event.type]), [
          ['Escape', 'keyDown'], ['Escape', 'keyUp'], ...spec.keys.map(k => [k,'keyDown']),
          ...[...spec.keys].reverse().map(k => [k,'keyUp']), ['Escape', 'keyDown'], ['Escape', 'keyUp']]);
      }
      controls.push('all five ordinary choices unchanged through actual composition and numbered transport');
    } finally { await ordinary.finish(); }

    const settle = state => ({...choose(state), choice: 'neutral-settle-200', grounded: false, airborne: true,
      review: 'OFFLINE fixture personally reviewed airborne and native Pause; neutral wait does not prove landing'});
    const neutral = await start({delay: 0});
    try {
      const s = await neutral.client.execute({action: 'capture'});
      const after = await neutral.client.execute(settle(s));
      assert.notEqual(after.token, s.token); assert.notEqual(after.capture.label, s.capture.label);
      assert(Date.parse(after.capture.at) > Date.parse(s.capture.at));
      assert.deepEqual(neutral.events.map(e => [e.event.code, e.event.type]), [
        ['Escape', 'keyDown'], ['Escape', 'keyUp'], ['Escape', 'keyDown'], ['Escape', 'keyUp']]);
      const resumeUpAck = neutral.rows.find(r => r.actualAckSent === neutral.events[1].id);
      assert(neutral.events[2].at - resumeUpAck.at >= 200);
      await assert.rejects(neutral.client.execute(settle(s)), /exact fresh capture token/);
      assert(neutral.client.view().closed);
      controls.push('actual composed execute + numbered transport neutral settle: only Escape pairs, fixed wait, fresh capture/token, replay sticky');
    } finally { await neutral.finish(); }
    for (const mode of ['missing-ground', 'identity-drift', 'late-DOWN', 'stale', 'changed-image',
      'neutral-missing-airborne', 'neutral-grounded', 'neutral-identity-drift', 'neutral-stale', 'neutral-latest-changed']) {
      const f = await start({delay: mode === 'late-DOWN' ? 1500 : 0});
      try {
        const s = await f.client.execute({action: 'capture'});
        const body = mode.startsWith('neutral-') ? settle(s) : choose(s);
        if (mode === 'neutral-missing-airborne') delete body.airborne;
        if (mode === 'neutral-grounded') body.grounded = true;
        if (mode === 'missing-ground') body.grounded = false;
        if (mode.endsWith('identity-drift')) { const changed = once(f.child, 'message'); f.child.send({change: true}); await changed; }
        if (mode.endsWith('stale')) {
          // Real wall-clock expiry. Never claim a model deliberation speed result.
          await new Promise(r => setTimeout(r, 12010));
        }
        if (mode === 'changed-image') fs.writeFileSync(path.join(f.out, s.capture.label + '.png'), 'changed');
        if (mode === 'neutral-latest-changed') fs.writeFileSync(path.join(f.out, 'latest.json'), JSON.stringify({...s.capture, label: 'other'}));
        await assert.rejects(f.client.execute(body));
        assert(f.client.view().closed);
        const count = f.events.length;
        const firstUnknown = fs.readFileSync(path.join(f.out, 'review-client-closed.json.gz'));
        await assert.rejects(f.client.execute({action: 'capture'}), /UNKNOWN/);
        assert.deepEqual(fs.readFileSync(path.join(f.out, 'review-client-closed.json.gz')), firstUnknown);
        assert.equal(f.events.length, count);
        if (mode !== 'late-DOWN') assert.equal(f.events.length, 0, mode + ' zero input');
        else {
          assert(f.events.some(e => e.event.code === 'ArrowRight' && e.event.type === 'keyUp'));
          assert.equal(f.events.filter(e => e.event.code === 'Escape' && e.event.type === 'keyDown').length, 1);
        }
        controls.push(mode + ': sticky UNKNOWN, no refresh/replay');
      } finally { await f.finish(); }
    }
    console.log(JSON.stringify({passed: true, controls, realChildren: children.length, nativeGame: false,
      modelDeliberationFits12s: 'UNPROVEN', historical143Cause: 'UNKNOWN'}));
  } finally {
    for (const c of children) if (c.exitCode === null && c.signalCode === null) c.kill('SIGKILL');
    await Promise.all(children.map(c => c.wait)); clearTimeout(cap);
    save(path.join(run, 'real-child-lifecycle-' + process.pid + '.json.gz'), receipts); restore();
  }
}

(process.argv[2] === '--fixture' ? fixture() : main()).catch(error => { console.error(error); process.exitCode = 1; });
