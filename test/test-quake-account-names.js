'use strict';
const assert = require('node:assert/strict');
const { quakeConfigWithDefaults, applyQuakeConfigDefaults } = require('../lib/browser-shell');
const { APPS } = require('../lib/apps');
const { VirtualFS } = require('../lib/filesystem');

(async () => {
  for (const id of ['quake2_demo', 'quake3_demo']) {
    const app = APPS[id], spec = app.quakeConfigDefaults;
    const seed = `${spec.command} name "${spec.defaultPlayer}"\n${spec.command} ${spec.serverKey} "noname"\nbind w "+forward"\n`;
    const result = quakeConfigWithDefaults(seed, spec, 'alice');
    assert(result.includes(`${spec.command} name "alice"`));
    assert(result.includes(`${spec.command} ${spec.serverKey} "berrry"`));
    assert(result.includes('bind w "+forward"'));
    assert.equal(quakeConfigWithDefaults(result, spec, 'bob'), result, 'saved custom name wins');
    const custom = `${spec.command} name "My player"\n${spec.command} ${spec.serverKey} "My server"\n`;
    assert.equal(quakeConfigWithDefaults(custom, spec, 'alice'), custom);
    assert(!quakeConfigWithDefaults(seed, spec, null).includes('name "null"'));
    const unsafe = quakeConfigWithDefaults('', spec, 'a";\\\nb');
    assert(unsafe.includes('name "ab"'));
    assert(quakeConfigWithDefaults('', spec, 'x'.repeat(80)).includes('name "' + 'x'.repeat(31) + '"'));
    assert(quakeConfigWithDefaults(`${spec.command} name "old"\n${spec.command} name "${spec.defaultPlayer}"\n`, spec, 'alice').includes('name "alice"'));
    const vfs = new VirtualFS();
    const handle = vfs.createFile(spec.path, 0x40000000, 2);
    const bytes = new TextEncoder().encode(seed);
    vfs.writeFile(handle, bytes, bytes.length);
    vfs.closeHandle(handle);
    global.fetch = async () => ({ ok: true, json: async () => ({id: 1, username: 'alice', display_name: 'Different display name'}) });
    await applyQuakeConfigDefaults(app, vfs);
    assert.equal(new TextDecoder().decode(vfs.files.get(vfs._normPath(spec.path)).data), result);
    global.fetch = async () => ({ok: false});
    await applyQuakeConfigDefaults(app, vfs);
    assert.equal(new TextDecoder().decode(vfs.files.get(vfs._normPath(spec.path)).data), result);
    console.log('PASS', id, 'account defaults, custom names, signed-out, escaping, actual VFS writes');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
