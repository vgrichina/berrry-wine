'use strict';
// Exact shared commandAck implementation isolated from CLI-only dependencies.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const reviewedCapture=()=>{throw Error('measurement review route unavailable in gameplay driver')};
const successfulCaptureAck=()=>{throw Error('measurement capture route unavailable in gameplay driver')};
function write(file, data) {
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(temp, file);
}
async function commandAck(out, command, timeoutMs = 55000) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 55000) throw Error('bounded ACK required');
  if (command.action === 'review-only') {
    let proof;
    try {
      const review = reviewedCapture(out, command.review);
      proof = { ok: true, action: command.action, review, shot: successfulCaptureAck(out, review.capture) };
    }
    catch (error) { write(path.join(out, 'review-handoff.json'), { ok: false, action: command.action, error: error.message, atEpochMs: Date.now() }); throw error; }
    write(path.join(out, 'review-handoff.json'), proof); return proof;
  }
  // No guest command is queued when the actual host capture/review handoff is
  // already stale. The browser monotonic five-second guard still decides arm.
  const clientFault = path.join(out, 'client-first-failure.json');
  if (fs.existsSync(clientFault) && command.action !== 'quit') throw Error('prior client first fault; never retry');
  if (command.action === 'measure') {
    try { reviewedCapture(out, command.review); }
    catch (error) {
      // A rejected prequeue review is still the first postlaunch fault. Keep
      // its cause and let the owner close normally, without another command.
      if (!fs.existsSync(clientFault)) write(clientFault, {
        source: 'ACK client prequeue review', action: command.action,
        review: command.review, error: error.stack || String(error), at: new Date().toISOString(), queued: false,
      });
      throw error;
    }
  }
  const commands = path.join(out, 'commands');
  const nums = fs.readdirSync(commands).filter(n => /^\d+\.json$/.test(n)).map(n => Number(n.slice(0, -5)));
  const n = nums.length ? Math.max(...nums) + 1 : 0;
  if (n && !JSON.parse(fs.readFileSync(path.join(out, 'reply-' + (n - 1) + '.json'))).ok) throw Error('prior ACK failed');
  if (fs.existsSync(path.join(out, 'cleanup.json'))) throw Error('runtime closed');
  const file = path.join(commands, n + '.json');
  fs.writeFileSync(file + '.tmp', JSON.stringify(command)); fs.renameSync(file + '.tmp', file);
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const reply = path.join(out, 'reply-' + n + '.json');
    if (fs.existsSync(reply)) {
      const ack = JSON.parse(fs.readFileSync(reply));
      if (!ack.ok) throw Error('command rejected: ' + ack.error);
      if (command.action === 'shot' || command.action === 'measure') {
        const capture = ack.capture, expected = path.join(out, (command.action === 'shot' ? command.name : 'after-measure') + '.png');
        if (!capture || capture.path !== expected || !Number.isFinite(capture.capturedAtMs) ||
            sha256(fs.readFileSync(expected)) !== capture.sha256) throw Error('exact capture ACK required');
      }
      return { number: n, ...ack };
    }
    if (fs.existsSync(path.join(out, 'first-failure.json'))) throw Error('runtime first fault');
    await pause(10);
  }
  throw Error('ACK deadline; never resend');
}

module.exports={writeJson:write,commandAck};
