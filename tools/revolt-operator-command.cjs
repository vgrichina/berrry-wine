'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {publishJSON} = require('./atomic-command-publication.js');

// The consumer watches the final filename. Never expose an open, partial record.
async function operate(out, command, timeoutMs = 25000) {
  if (fs.existsSync(path.join(out, 'UNKNOWN.json'))) throw Error('closed UNKNOWN no command');
  let n = 0;
  while (fs.existsSync(path.join(out, 'command-' + n + '.json'))) n++;
  publishJSON(path.join(out, 'command-' + n + '.json'), command);
  const end = Date.now() + timeoutMs;
  for (;;) {
    const receipt = path.join(out, 'receipt-' + n + '.json');
    if (fs.existsSync(receipt)) return JSON.parse(fs.readFileSync(receipt, 'utf8'));
    if (fs.existsSync(path.join(out, 'failure.json'))) throw Error(fs.readFileSync(path.join(out, 'failure.json'), 'utf8'));
    if (fs.existsSync(path.join(out, 'UNKNOWN.json'))) throw Error('closed UNKNOWN while awaiting receipt');
    if (Date.now() >= end) throw Error('operator finite wait expired');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

module.exports = {operate};
if (require.main === module) {
  operate(path.resolve(process.argv[2]), JSON.parse(process.argv[3])).then(
    value => console.log(JSON.stringify(value, null, 2)),
    error => { console.error(error.stack); process.exitCode = 1; });
}
