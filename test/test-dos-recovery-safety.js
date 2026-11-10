'use strict';

const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startStaticServer } = require('./static-server');
const { spawnSync } = require('child_process');
const { recover, download } = require('../tools/fetch-dos-game-corpus');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dos-recovery-test-'));
  let server;
  try {
    const input = path.join(root, 'input');
    fs.mkdirSync(input);
    fs.writeFileSync(path.join(input, 'GAME.EXE'), 'synthetic executable');
    fs.writeFileSync(path.join(input, 'DATA.DAT'), 'companion data');
    const zip = path.join(root, 'source.zip');
    const packed = spawnSync('zip', ['-q', zip, 'GAME.EXE', 'DATA.DAT'], { cwd: input });
    assert.equal(packed.status, 0, 'test requires zip and unzip');
    const bytes = fs.readFileSync(zip);
    server = await startStaticServer({ root, handleRequest(request, response) {
      if (request.url === '/404') { response.writeHead(404); response.end(); return; }
      if (request.url === '/truncated') {
        response.writeHead(200, { 'Content-Length': bytes.length + 100 });
        response.end(bytes);
        return;
      }
      response.end(bytes);
    } });
    const url = `http://127.0.0.1:${server.address().port}`;
    const game = { id: 'demo', executable: 'GAME.EXE', package: {
      file: 'demo.zip', url, size: bytes.length,
      sha1: crypto.createHash('sha1').update(bytes).digest('hex'),
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    } };
    let count = 0;
    async function scenario(name, overrides, expected, check) {
      const assetRoot = path.join(root, name);
      const previous = path.join(assetRoot, game.id);
      fs.mkdirSync(previous, { recursive: true });
      fs.writeFileSync(path.join(previous, 'GAME.EXE'), 'old game');
      fs.writeFileSync(path.join(previous, 'save.dat'), 'old save');
      fs.writeFileSync(path.join(previous, 'demo.zip'), 'old archive');
      const options = { assetRoot, force: true, ...overrides };
      if (expected) await assert.rejects(recover(game, options), expected);
      else await recover(game, options);
      if (expected && !check) {
        assert.equal(fs.readFileSync(path.join(previous, 'GAME.EXE'), 'utf8'), 'old game');
        assert.equal(fs.readFileSync(path.join(previous, 'save.dat'), 'utf8'), 'old save');
        assert.equal(fs.readFileSync(path.join(previous, 'demo.zip'), 'utf8'), 'old archive');
      }
      if (check) check(assetRoot, previous);
      if (name !== 'rollback-failure') assert.deepEqual(fs.readdirSync(assetRoot), ['demo']);
      count++;
    }
    await scenario('http-failure', { download: (_, dest) => download(url + '/404', dest) }, /HTTP 404/);
    await scenario('truncated', { download: (_, dest) => download(url + '/truncated', dest) }, /aborted|reset|premature/i);
    await scenario('bad-hash', { download: (_, dest) => fs.writeFileSync(dest, 'bad') }, /pinned package/);
    await scenario('unzip-failure', { extract: (_, dir) => {
      fs.writeFileSync(path.join(dir, 'partial'), 'partial');
      throw new Error('extraction failed');
    } }, /extraction failed/);
    await scenario('missing-executable', { extract: () => {} }, /missing GAME.EXE/);
    await scenario('publish-failure', { rename: (from, to) => {
      if (path.basename(from) === 'tree') throw new Error('publication failed');
      fs.renameSync(from, to);
    } }, /publication failed/);
    await scenario('rollback-failure', { rename: (from, to) => {
      if (['tree', 'previous'].includes(path.basename(from))) throw new Error('rename denied');
      fs.renameSync(from, to);
    } }, /previous tree retained at/, assetRoot => {
      const stage = fs.readdirSync(assetRoot).find(name => name.startsWith('.demo-recovery-'));
      assert(stage);
      const backup = path.join(assetRoot, stage, 'previous');
      assert.equal(fs.readFileSync(path.join(backup, 'save.dat'), 'utf8'), 'old save');
      assert.equal(fs.readFileSync(path.join(backup, 'demo.zip'), 'utf8'), 'old archive');
    });
    await scenario('success', {}, null, (_, previous) => {
      assert.equal(fs.readFileSync(path.join(previous, 'GAME.EXE'), 'utf8'), 'synthetic executable');
      assert.equal(fs.readFileSync(path.join(previous, 'DATA.DAT'), 'utf8'), 'companion data');
      assert.deepEqual(fs.readFileSync(path.join(previous, 'demo.zip')), bytes);
      assert(!fs.existsSync(path.join(previous, 'save.dat')), 'forced recovery replaces stale contents');
    });
    const cachedRoot = path.join(root, 'cached');
    fs.mkdirSync(path.join(cachedRoot, game.id), { recursive: true });
    fs.copyFileSync(zip, path.join(cachedRoot, game.id, game.package.file));
    fs.writeFileSync(path.join(cachedRoot, game.id, 'save.dat'), 'keep this save');
    const noNetwork = () => { throw new Error('cache should avoid network'); };
    await recover(game, { assetRoot: cachedRoot, force: false, download: noNetwork });
    assert.equal(fs.readFileSync(path.join(cachedRoot, game.id, 'DATA.DAT'), 'utf8'), 'companion data');
    assert.equal(fs.readFileSync(path.join(cachedRoot, game.id, 'save.dat'), 'utf8'), 'keep this save');
    await recover(game, { assetRoot: cachedRoot, force: false, download: noNetwork, extract: noNetwork });
    console.log(`PASS ${count} DOS recovery failure/publication cases plus cached extraction/reuse (synthetic ZIP, local HTTP; no guest runtime)`);
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
