'use strict';
// Existing control API only. Never clicks, patches guest state, or launches a run.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const [id, action, reviewedImage] = process.argv.slice(2);
assert(/^20261019-dungeon-siege-[a-z0-9-]+$/.test(id || ''), 'Provide the active run ID');
assert(['arm-reviewed', 'disarm'].includes(action), 'Use arm-reviewed IMAGE or disarm');
const out = path.join('/home/user/wine-assembly/scratch/runs', id);
const launch = JSON.parse(fs.readFileSync(path.join(out, 'launch.json')));
assert.equal(launch.traceReads, true, 'The active controller must use --trace-reads');
let image = null;
if (action === 'arm-reviewed') {
  assert(reviewedImage && path.basename(reviewedImage) === reviewedImage && reviewedImage.endsWith('.png'), 'Supply an already visually reviewed EULA image basename within this run');
  const p = path.join(out, reviewedImage);
  assert(fs.lstatSync(p).isFile() && !fs.lstatSync(p).isSymbolicLink());
  image = { path: reviewedImage, sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'), reviewedByInvokingAgent: true };
}
function post(command) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(command);
    const req = http.request({ hostname: '127.0.0.1', port: 8141, path: '/ctl', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let text = '';
      res.on('data', b => { text += b; if (text.length > 65536) req.destroy(new Error('control reply cap')); });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('control HTTP ' + res.statusCode + ': ' + text));
        try {
          const reply = JSON.parse(text);
          assert.equal(reply.ok, true, JSON.stringify(reply));
          resolve(reply);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('control deadline; no automatic retry')));
    req.end(body);
  });
}
(async () => {
  const receipt = { at: new Date().toISOString(), action, image, replies: [], inputDelivered: false };
  const target = path.join(out, action + '-trace.json');
  assert(!fs.existsSync(target), 'Preserve the previous control receipt');
  try {
    const on = action === 'arm-reviewed';
    // ctx.trace is the same Set shared by main and cooperative worker contexts.
    receipt.replies.push(await post({ action: 'eval', code: on
      ? "ctx.trace.add('fs'); ctx._debugReadFile = true; ({fs:ctx.trace.has('fs'),batch:tickState.batch})"
      : "ctx.trace.delete('fs'); ctx._debugReadFile = false; ({fs:ctx.trace.has('fs'),batch:tickState.batch})" }));
    receipt.replies.push(await post({ action: 'trace-api', on }));
    // A guest-side rejected command must never be recorded as a successful arm.
    for (const reply of receipt.replies) {
      const results = Array.isArray(reply) ? reply : (reply.results || [reply]);
      for (const r of results) assert(r.ok !== false && !r.error, JSON.stringify(r));
    }
    receipt.complete = true;
  } catch (e) { receipt.complete = false; receipt.error = e.message; process.exitCode = 1; }
  fs.writeFileSync(target, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
})();
