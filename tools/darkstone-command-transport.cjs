'use strict';

// Keep completed runs immutable. Adapt only the exact selected consumer, using
// the ACK client's own timeout contract before reserving an ID or publishing.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const Module = require('node:module');
const selectedSha = '0e804950876a8e7b8e6f0fa399b3e0d4cce38861b21c771b7aa131db1d22ab85';
const quitTimeoutMs = 55000;

function repairTransport(source) {
  if (crypto.createHash('sha256').update(source).digest('hex') !== selectedSha) {
    throw Error('unrecognized Darkstone transport; review revision before repair');
  }
  const before = 'exports.request=async function(out,id,command,timeout=1000){';
  if (source.split(before).length !== 2) throw Error('ambiguous timeout admission anchor');
  return source.replace(before, `exports.request=async function(out,id,command,timeout=command.action==='quit'?${quitTimeoutMs}:1000){
 // Invalid timeouts are known prepublication failures in the actual ACK client.
 // Every exception after entering commandAck remains sticky: publication may
 // have happened, including a rename followed by an unreadable/lost/late ACK.
 base.validateAckTimeout(timeout);`);
}

function loadTransport(file) {
  file = path.resolve(file);
  const source = repairTransport(fs.readFileSync(file, 'utf8'));
  const consumer = new Module(file, module);
  consumer.filename = file;
  consumer.paths = Module._nodeModulePaths(path.dirname(file));
  consumer._compile(source, file);
  return consumer.exports;
}

module.exports = {repairTransport, loadTransport, selectedSha, quitTimeoutMs};
