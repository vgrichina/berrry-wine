'use strict';
// Exercise the real queue boundary; refusal must precede any request side effect.
// Port of tools/native-startup-barrier.test.py.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict'), crypto = require('node:crypto'), cp = require('node:child_process');
const barrier = require('./native-startup-barrier.js');

const data = Buffer.from('original browser launcher');
const pins = {files: [{path: 'browser.cjs', size: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex')}]};

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'startup-barrier-'));
  const t = {root, manifest: path.join(root, 'pins.json'), receipt: path.join(root, 'ready.json'),
             request: path.join(root, 'request.json'), provider: path.join(root, 'browser.cjs')};
  fs.writeFileSync(t.manifest, JSON.stringify(pins));
  t.queue = () => { barrier.require(t.root, t.manifest, t.receipt); fs.writeFileSync(t.request, 'one launch', {flag: 'wx'}); };
  t.ready = () => { fs.writeFileSync(t.provider, data); barrier.publish(t.root, t.manifest, t.receipt); };
  t.refused = () => { assert.throws(() => t.queue()); assert.equal(fs.existsSync(t.request), false); };
  return t;
}
const exists = /EEXIST/;

const tests = {
  observed_race_no_receipt_even_if_some_providers_exist(t) { fs.writeFileSync(t.provider, data); t.refused(); },
  missing_provider_cannot_publish(t) {
    assert.throws(() => barrier.publish(t.root, t.manifest, t.receipt), /ENOENT/);
    assert.equal(fs.existsSync(t.receipt), false); t.refused();
  },
  valid_staging_allows_one_request_only(t) { t.ready(); t.queue(); assert.throws(() => t.queue(), exists); },
  changed_same_size_provider_is_refused(t) { t.ready(); fs.writeFileSync(t.provider, Buffer.alloc(data.length, 'x')); t.refused(); },
  removed_provider_is_refused(t) { t.ready(); fs.unlinkSync(t.provider); t.refused(); },
  changed_manifest_generation_is_refused(t) { t.ready(); fs.writeFileSync(t.manifest, JSON.stringify(pins, null, 2)); t.refused(); },
  partial_receipt_is_refused(t) { fs.writeFileSync(t.provider, data); fs.writeFileSync(t.receipt, '{"version":'); t.refused(); },
  cannot_overwrite_earlier_receipt(t) { t.ready(); assert.throws(() => barrier.publish(t.root, t.manifest, t.receipt), exists); },
  empty_manifest_refused(t) {
    fs.writeFileSync(t.manifest, '{"files":[]}');
    assert.throws(() => barrier.publish(t.root, t.manifest, t.receipt), /empty startup manifest/);
  },
  escape_and_duplicate_refused(t) {
    fs.writeFileSync(t.provider, data);
    for (const files of [[{...pins.files[0], path: '../escape'}], [...pins.files, ...pins.files]]) {
      fs.writeFileSync(t.manifest, JSON.stringify({files}));
      assert.throws(() => barrier.publish(t.root, t.manifest, t.receipt), /outside runtime root|duplicate startup provider/);
    }
    assert.equal(fs.existsSync(t.receipt), false);
  },
  parent_rechecks_before_consuming_request(t) {
    t.ready(); t.queue();
    fs.writeFileSync(t.provider, 'incomplete upload');
    assert.throws(() => { barrier.require(t.root, t.manifest, t.receipt); fs.renameSync(t.request, path.join(t.root, 'consumed.json')); });
    assert.equal(fs.existsSync(t.request), true);
    assert.equal(fs.existsSync(path.join(t.root, 'consumed.json')), false);
  },
  // CLI contract: receipt is sorted Python json.dump; stdout is unsorted json.dumps.
  cli_publish_require_bytes(t) {
    fs.writeFileSync(t.provider, data);
    const run = action => cp.spawnSync(process.execPath, [path.join(__dirname, 'native-startup-barrier.js'), action, t.root, t.manifest, t.receipt], {encoding: 'utf8'});
    const out = run('publish');
    assert.equal(out.status, 0, out.stderr);
    const root = fs.realpathSync(t.root), sha = crypto.createHash('sha256').update(fs.readFileSync(t.manifest)).digest('hex');
    assert.equal(out.stdout, `{"version": 1, "root": ${JSON.stringify(root)}, "manifestSha256": "${sha}", "providers": 1, "bytes": ${data.length}}\n`);
    assert.equal(fs.readFileSync(t.receipt, 'utf8'), `{"bytes": ${data.length}, "manifestSha256": "${sha}", "providers": 1, "root": ${JSON.stringify(root)}, "version": 1}`);
    assert.equal(run('require').stdout, out.stdout);
    const again = run('publish');
    assert.equal(again.status, 1); assert.match(again.stderr, /EEXIST/);
    assert.equal(cp.spawnSync(process.execPath, [path.join(__dirname, 'native-startup-barrier.js'), 'bogus'], {encoding: 'utf8'}).status, 2);
  },
};

let passed = 0;
for (const [name, body] of Object.entries(tests)) {
  const t = fixture();
  try { body(t); passed++; console.log('ok', name); }
  finally { fs.rmSync(t.root, {recursive: true, force: true}); }
}
console.log(`native-startup-barrier: ${passed}/${Object.keys(tests).length} passed`);
