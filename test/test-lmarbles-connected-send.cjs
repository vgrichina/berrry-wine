'use strict';
// Real controller, real HTTP sockets and the production native input guard.
// Only connection timing is authored. Receipt of bytes is not consumption.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const http = require('node:http'), net = require('node:net');
const ctl = require('../tools/lmarbles-controller.cjs');
const common = require('../tools/native-supervisor-common.cjs');
const { createGuardedInput } = require('../lib/cli-guarded-input');
for (const mode of ['fresh', 'fresh-strict', 'expired-socket', 'expired-connect', 'expired-strict', 'replaced', 'review-replaced', 'unknown', 'partial-effect', 'lost-ack', 'partial-write', 'end-throw', 'remote-forgery', 'release-failed', 'release-mismatch', 'physical-held', 'owner-after-refusal', 'snapshot-replaced']) test(mode, { timeout: 15000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'connected-send-'));
  const rows = [], refs = { queue: [] }; let physicalUp = true, batch = 0;
  const guard = createGuardedInput({ snapshot: () => ({ healthy: true, refs }), cleanup: () => { physicalUp = true; rows.push({ action: 'physical-UP', at: Date.now() }); } });
  const snapshot = () => ({ batch: ++batch, quit: false, eip: '0x1', mainHwnd: '0x1', screen: { w: 1, h: 1 }, physicalUp, capture: '0x0' });
  const server = http.createServer((req, res) => { let body = ''; req.on('data', b => body += b); req.on('end', async () => {
    try {
      assert.equal(Buffer.byteLength(body), Number(req.headers['content-length']));
      const command = JSON.parse(body); rows.push({ action: command.action || command.cmd, at: Date.now(), command });
      let value;
      if (command.action === 'snapshot') {
        value = snapshot();
        if (mode === 'snapshot-replaced' && rows.some(r => r.action === 'guarded-release'))
          fs.writeFileSync(path.join(dir, 'input-owner.json'), JSON.stringify({ ...owner, epoch: 'replacement' }));
      }
      else if (command.action === 'guarded-status') value = guard.status(command.nonce);
      else if (command.action === 'guarded-release') {
        if (mode === 'release-failed') throw Error('release failed');
        value = guard.release(command.owner);
        if (mode === 'release-mismatch') value.owner = 'foreign-owner';
        if (mode === 'physical-held') physicalUp = false;
        if (mode === 'owner-after-refusal') fs.writeFileSync(path.join(dir, 'input-owner.json'), JSON.stringify({ ...owner, epoch: 'replacement' }));
      }
      else if (command.action === 'guarded-input') {
        if (mode === 'remote-forgery') { res.statusCode = 503; res.end(JSON.stringify({ ok: false, error: 'local connected callback refused before body attempt', cause: { name: 'ConnectedBudgetRefused' } })); return; }
        if (mode === 'unknown') value = { state: 'UNKNOWN', consumed: false };
        else {
          const ticket = guard.prepare(command.guard, { action: 'keydown', code: 13 });
          value = guard.consume(ticket, () => { physicalUp = false; rows.push({ action: 'guest-DOWN', at: Date.now(), nonce: command.guard.nonce }); });
          if (mode === 'partial-effect') value = { state: 'UNKNOWN', consumed: false, reason: 'partial compound effect' };
          if (mode === 'lost-ack') { res.destroy(); return; }
        }
      } else if (command.cmd?.startsWith('png:')) { fs.writeFileSync(command.cmd.slice(4), 'fixture-complete-image'); value = { batch }; }
      else throw Error('unexpected command');
      res.end(JSON.stringify({ ok: true, value }));
    } catch (e) { res.end(JSON.stringify({ ok: false, error: e.message })); }
  }); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const original = http.request, agent = new http.Agent({ keepAlive: false });
  const owner = guard.bind();
  ctl.R = dir; ctl.URL = `http://127.0.0.1:${server.address().port}/ctl`;
  const at = common.now();
  ctl.save('launch.json', { at, deadline: at + 400, reserveSeconds: 180, gameplayCutoff: at + 220,
    ...(['fresh-strict', 'expired-strict'].includes(mode) ? { inputPolicy: { gameFreshnessSeconds: 5, menuFreshnessSeconds: 30 } } : {}) });
  ctl.save('native-pid.json', { pid: process.pid, startToken: common.token(process.pid) });
  ctl.save('input-owner.json', owner); ctl.save('lease-snapshot.json', { mainHwnd: '0x1', screen: { w: 1, h: 1 } });
  fs.writeFileSync(path.join(dir, 'review.png'), 'complete-reviewed-fixture');
  const hash = common.sha256(fs.readFileSync(path.join(dir, 'review.png')));
  const expires = mode.startsWith('expired-') || ['release-failed', 'release-mismatch', 'physical-held', 'owner-after-refusal', 'snapshot-replaced'].includes(mode);
  ctl.save('review.json', { at: mode === 'expired-strict' ? at - 4.1 : expires ? at - 29.4 : at, pngSHA256: hash, snapshot: snapshot() });
  ctl.save('review-review.json', { at, pngSHA256: hash, scene: 'game', observation: 'authored complete fixture' });
  agent.createConnection = (options, callback) => {
    if (mode === 'expired-connect') {
      const socket = new net.Socket();
      socket.once('connect', () => rows.push({ action: 'connected', at: Date.now() }));
      socket.connecting = true;
      setTimeout(() => socket.connect(options), 750);
      return socket;
    }
    setTimeout(() => {
      if (mode === 'replaced') fs.writeFileSync(path.join(dir, 'input-owner.json'), JSON.stringify({ ...owner, epoch: 'replacement' }));
      if (mode === 'review-replaced') fs.writeFileSync(path.join(dir, 'review-review.json'), JSON.stringify({ at, pngSHA256: hash, observation: 'replacement', scene: 'game' }));
      const socket = net.createConnection(options);
      socket.once('connect', () => rows.push({ action: 'connected', at: Date.now() }));
      callback(null, socket);
    }, mode === 'expired-strict' ? 450 : expires ? 750 : 30);
  };
  let requestNumber = 0;
  http.request = function(url, options, ...rest) {
    const down = ++requestNumber === 2;
    const req = original.call(this, url, { ...options, agent: down ? agent : undefined }, ...rest);
    if (down && ['partial-write', 'end-throw'].includes(mode)) {
      const end = req.end;
      req.end = function(data) {
        if (mode === 'partial-write') { this.write(data.subarray(0, 8)); throw Error('after partial body write'); }
        end.call(this, data); throw Error('end threw after transport attempt');
      };
    }
    return req;
  };
  try {
    // Release runs in its own real process and uses its own unmodified transport.
    if (mode.startsWith('fresh')) {
      await ctl.pulse('press', ['keydown:13'], 100, 'review', 'fixture Enter');
      const receipt = ctl.read('press-receipt.json'), up = ctl.read('press-up.json');
      assert.equal(receipt.state, 'CONSUMED'); assert.equal(receipt.consumed, true);
      assert.equal(up.state, 'ACK'); assert.equal(up.reply.owner, owner.owner); assert.equal(up.reply.released, true);
      assert.equal(rows.filter(r => r.action === 'guest-DOWN').length, 1); assert(physicalUp);
      const input = rows.find(r => r.action === 'guarded-input').command;
      assert.equal(input.cmd, 'keydown:13'); assert.equal(input.guard.owner, owner.owner);
      assert.equal(input.guard.epoch, owner.epoch); assert.equal(input.guard.nonce, ctl.read('press-intent.json').nonces[0]);
      assert(ctl.read('press-armed.json').at * 1000 <= rows.find(r => r.action === 'guest-DOWN').at);
      assert(receipt.consumedAt < input.guard.deadline);
    } else if (mode.startsWith('expired-')) {
      assert.match(await ctl.pulse('press', ['keydown:13'], 100, 'review', 'fixture expiry'), /^NOT_SENT/);
      assert.equal(rows.filter(r => r.action === 'guarded-input' || r.action === 'guest-DOWN').length, 0);
      assert.equal(ctl.read('press-rejection.json').stage, 'connected-before-body');
      assert(!fs.existsSync(path.join(dir, 'terminal-input-failure.json')));
      assert(rows.find(r => r.action === 'connected').at + (mode === 'expired-strict' ? 500 : 0) >= ctl.read('press-operation.json').targetingDeadline * 1000);
      await ctl.capture('freshreview');
      const rr = ctl.read('freshreview.json');
      ctl.save('freshreview-review.json', { at: common.now(), pngSHA256: rr.pngSHA256, scene: 'game', observation: 'new whole fixture review' });
      await ctl.pulse('newpress', ['keydown:13'], 100, 'freshreview', 'new intent after proved unsent expiry');
      assert.equal(ctl.read('newpress-receipt.json').state, 'CONSUMED');
      assert.notEqual(ctl.read('press-intent.json').nonces[0], ctl.read('newpress-intent.json').nonces[0]);
      assert.equal(rows.filter(r => r.action === 'guest-DOWN').length, 1); assert(physicalUp);
      const count = rows.length;
      await assert.rejects(ctl.pulse('oldreview', ['keydown:13'], 100, 'review', 'old review forbidden'), /capture already reserved|review age expired/);
      assert.equal(rows.slice(count).filter(r => r.action === 'guarded-input').length, 0);
    } else {
      await assert.rejects(ctl.pulse('press', ['keydown:13'], 100, 'review', 'fixture refusal'));
      assert.equal(rows.filter(r => r.action === 'guest-DOWN').length, ['end-throw', 'partial-effect', 'lost-ack'].includes(mode) ? 1 : 0);
      assert.equal(rows.filter(r => r.action === 'guarded-input').length, ['unknown', 'remote-forgery', 'end-throw', 'partial-effect', 'lost-ack'].includes(mode) ? 1 : 0);
      assert.equal(ctl.read('press-up.json').state, mode === 'release-failed' ? 'UNKNOWN' : 'ACK');
      assert.equal(physicalUp, mode !== 'physical-held');
      if (mode.startsWith('expired-')) assert(rows.find(r => r.action === 'connected').at >= ctl.read('press-operation.json').targetingDeadline * 1000);
      const count = rows.length;
      await assert.rejects(ctl.pulse('later', ['keydown:13'], 100, 'review', 'must stay closed'), /sticky UNKNOWN/);
      assert.equal(rows.length, count); assert(ctl.read('terminal-input-failure.json').noReplay);
    }
    assert(rows.some(r => r.action === 'guarded-release' && r.command.owner === owner.owner));
    const wait = ctl.read('press-release-wait.json');
    assert(wait.actualWait && wait.stdoutEOF && wait.stderrEOF);
    if (process.env.LMARBLES_CONNECTED_OUT) {
      const out = path.join(process.env.LMARBLES_CONNECTED_OUT, mode); fs.mkdirSync(out, { recursive: true });
      for (const name of fs.readdirSync(dir)) fs.copyFileSync(path.join(dir, name), path.join(out, name));
      fs.writeFileSync(path.join(out, 'http-and-consumption.json'), JSON.stringify(rows, null, 2));
    }
  } finally { http.request = original; agent.destroy(); guard.close(); await new Promise(r => server.close(r)); fs.rmSync(dir, { recursive: true, force: true }); }
});
