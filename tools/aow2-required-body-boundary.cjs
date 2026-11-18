'use strict';
// AoWII prerequisite: immutable text recovery and conservative body diagnosis.
// This never changes transport acceptance or substitutes application bytes.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const lines = s => s.match(/[^\n]*\n|[^\n]+$/g) || [];
function applyRecordedPatch(name, base, patch) {
  const header = `diff --git a/${name} b/${name}\n`, start = patch.indexOf(header);
  if (start < 0) return base;
  const end = patch.indexOf('\ndiff --git ', start + header.length);
  const part = lines(patch.slice(start, end < 0 ? undefined : end + 1));
  const old = lines(base.toString()), out = []; let cursor = 0;
  for (let i = 0; i < part.length; i++) {
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(part[i]);
    if (!m) continue;
    const at = +m[1] - (+m[1] === 0 ? 0 : 1);
    assert(at >= cursor); out.push(...old.slice(cursor, at)); cursor = at;
    let removed = 0, added = 0;
    for (i++; i < part.length && !part[i].startsWith('@@ '); i++) {
      const line = part[i], kind = line[0];
      assert.notEqual(kind, '\\', 'newline exception needs explicit recovery');
      if (kind === ' ' || kind === '-') { assert.equal(old[cursor], line.slice(1)); cursor++; removed++; }
      if (kind === ' ' || kind === '+') { out.push(line.slice(1)); added++; }
    }
    assert.equal(removed, m[2] === undefined ? 1 : +m[2]);
    assert.equal(added, m[4] === undefined ? 1 : +m[4]); i--;
  }
  out.push(...old.slice(cursor)); return Buffer.from(out.join(''));
}
function recover({name, expected, current, readGit, patch}) {
  if (current && sha(current) === expected) return {bytes: current, resolution: 'current exact hash'};
  assert(/^(src\/|lib\/|host\.js$|index\.html$)/.test(name), 'media cannot be reconstructed or replaced');
  const bytes = applyRecordedPatch(name, readGit(name), patch);
  assert.equal(sha(bytes), expected, 'reconstructed source hash ' + name);
  return {bytes, resolution: 'exact Git plus recorded patch', currentSHA256: current ? sha(current) : null};
}
function diagnose({network, caller, expectedBytes}) {
  const failed = network.find(r => r.event === 'Network.loadingFailed');
  const finished = network.filter(r => r.event === 'Network.loadingFinished');
  const reads = caller.filter(r => r.event === 'read-resolved');
  const deliveredBytes = reads.reduce((n, r) => n + (r.bytes || 0), 0);
  const eof = reads.some(r => r.done === true);
  return {deliveredBytes, eof, exactLength: deliveredBytes === expectedBytes,
    browserFinished: finished.length === 1, browserFailure: failed?.row || null,
    explicitAbort: caller.some(r => ['signal-abort', 'abort-call', 'cancel-call'].includes(r.event)),
    accepted: !failed && finished.length === 1 && eof && deliveredBytes === expectedBytes,
    cause: failed ? 'UNKNOWN' : 'NO_OBSERVED_NETWORK_FAILURE'};
}
module.exports = {sha, applyRecordedPatch, recover, diagnose};
