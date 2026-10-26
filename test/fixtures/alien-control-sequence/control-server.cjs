// Real production HTTP server, injected callback only; never loads the guest.
'use strict';
const fs = require('fs');
const { startControlServer } = require('../../../lib/control-server.js');
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let index = 0;
const server = startControlServer({port: 0, commandTimeoutMs: 20,
  log: () => {},
  onCommand: command => {
    fs.appendFileSync(config.sends, JSON.stringify(command) + '\n');
    const entry = config.responses[index++];
    if (!entry) throw Error('unexpected downstream command');
    if (entry.reject) throw Error(entry.reject);
    if (entry.hang) return new Promise(() => {});
    return entry.value;
  },
});
// startControlServer logs port0 rather than the allocated port. Its public
// handle is the actual Node server (no production changes needed).
server.server.on('listening', () => console.log(JSON.stringify({port: server.server.address().port})));
