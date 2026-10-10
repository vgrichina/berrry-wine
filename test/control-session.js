'use strict';

const { spawn } = require('child_process');

// Shared client for test/run.js --control-stdin. Callers retain ownership of
// the input schedule and assertions; this module owns the byte-stream framing,
// request ids, reply routing, output capture, and pending-request teardown.
function startControlSession(args, options = {}) {
  const {
    command = process.execPath,
    cwd = process.cwd(),
    idPrefix = 'ctl-',
    spawnOptions = {},
  } = options;
  const child = spawn(command, args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...spawnOptions,
  });

  let output = '';
  let lineBuffer = '';
  let nextId = 1;
  const pending = new Map();
  let closed = false;
  let terminalError = null;
  // close follows exit AND stdio draining, so a final reply isn't discarded
  // merely because the process exited before its stdout data was delivered.
  const exited = new Promise(resolve => child.on('close', resolve));
  function rejectPending(error) {
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  }

  child.stdout.on('data', data => {
    output += data;
    lineBuffer += data;
    const lines = lineBuffer.split(/\r?\n/);
    lineBuffer = lines.pop() || '';
    for (const line of lines) {
      const match = line.match(/^\[ctl\] (.*)$/);
      if (!match) continue;
      let reply;
      try { reply = JSON.parse(match[1]); } catch (_) { continue; }
      if (!reply || typeof reply !== 'object' || Array.isArray(reply)) continue;
      const waiter = pending.get(reply.id);
      if (!waiter) continue;
      pending.delete(reply.id);
      if (reply.ok) waiter.resolve(reply.value);
      else waiter.reject(new Error(reply.error || 'control command failed'));
    }
  });
  child.stderr.on('data', data => { output += data; });
  child.on('error', error => {
    terminalError = error;
    rejectPending(error);
  });
  child.stdin.on('error', error => {
    terminalError = terminalError || error;
    rejectPending(terminalError);
  });
  child.on('close', (code, signal) => {
    closed = true;
    const how = `exit ${code}${signal ? `, signal ${signal}` : ''}`;
    // A spawn or stdin failure already rejected what was pending with its own
    // cause. Otherwise name each unanswered request: which command the process
    // died under is the first thing a failing route needs to know.
    if (!terminalError) {
      for (const [id, waiter] of pending) {
        waiter.reject(new Error(`run.js exited before replying to ${id} (${how})`));
      }
      pending.clear();
      terminalError = new Error(`run.js exited before replying (${how})`);
    }
    rejectPending(terminalError);
  });

  function send(commandValue) {
    const id = `${idPrefix}${nextId++}`;
    const payload = typeof commandValue === 'string'
      ? { id, cmd: commandValue }
      : { ...commandValue, id };
    return new Promise((resolve, reject) => {
      if (terminalError || closed || child.exitCode !== null || child.signalCode !== null) {
        reject(terminalError || new Error('run.js exited; control session is closed'));
        return;
      }
      // Serialize before adding a waiter: cyclic inputs must not leak one.
      const line = `${JSON.stringify(payload)}\n`;
      pending.set(id, { resolve, reject });
      child.stdin.write(line, error => {
        if (!error) return;
        pending.delete(id);
        reject(error);
      });
    });
  }

  const step = n => send({ action: 'step', n });
  async function quit(optionsValue = {}) {
    const { ignoreReplyError = false } = optionsValue;
    let replyError = null;
    if (!closed && !terminalError && child.exitCode === null && child.signalCode === null) {
      try { await send({ action: 'quit' }); } catch (error) { replyError = error; }
      child.stdin.end();
    }
    const code = await exited;
    if (replyError && !ignoreReplyError) throw replyError;
    return code;
  }

  return {
    child,
    exited,
    send,
    step,
    quit,
    output: () => output,
  };
}

module.exports = { startControlSession };
