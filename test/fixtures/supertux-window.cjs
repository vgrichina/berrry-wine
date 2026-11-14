'use strict';
const fs = require('fs');
const { startControlServer } = require('../../lib/control-server');
const { createGuardedInput } = require('../../lib/cli-guarded-input');
let batch = 0;
const events = [], refs = { queue: [] };
const guard = createGuardedInput({ snapshot: () => ({ healthy: true, refs }),
  cleanup: () => events.push({ kind: 'UP', at: Date.now() }) });
const tick = setInterval(() => batch++, 10);
const transport = startControlServer({ port: 0, commandTimeoutMs: 700, onCommand(c) {
  if (c.action === 'snapshot') return { fixturePid: process.pid, batch, quit: false,
    eip: '0x1', mainHwnd: '0x1', screen: { w: 1, h: 1 } };
  if (c.action === 'guarded-bind') return guard.bind();
  if (c.action === 'guarded-status') return guard.status(c.nonce);
  if (c.action === 'guarded-release') return guard.release(c.owner);
  if (c.action === 'guarded-input') {
    const key = Number(c.cmd.split(':')[1]);
    const ticket = guard.prepare(c.guard, { action: 'keydown', code: key });
    const ack = guard.wait(ticket);
    guard.consume(ticket, () => events.push({ kind: 'DOWN', at: Date.now(), nonce: c.guard.nonce }));
    if (key === 32) {
      const dropped = new Promise(() => {});
      dropped.cancel = ack.cancel;
      return dropped;
    }
    return ack;
  }
  if (c.cmd?.startsWith('png:')) {
    fs.writeFileSync(c.cmd.slice(4), 'synthetic endpoint fixture');
    return { fixture: true };
  }
  if (c.action === 'quit') {
    console.log(JSON.stringify({ events }));
    clearInterval(tick); guard.close();
    setTimeout(() => { transport.close(); process.exit(0); }, 20);
    return {};
  }
  throw Error('unsupported fixture command');
} });
transport.server.on('listening', () => console.log(JSON.stringify({
  fixturePid: process.pid, url: `http://127.0.0.1:${transport.server.address().port}/ctl`
})));
setTimeout(() => process.exit(2), 60000).unref();
