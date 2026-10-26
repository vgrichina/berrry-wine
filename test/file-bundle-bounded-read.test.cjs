'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const sourcePath = process.env.FILE_BUNDLE_TEST_SOURCE || path.join(__dirname, '../lib/file-bundle.js');
const source = fs.readFileSync(sourcePath, 'utf8');

// Exercise the production loop with an eight-byte limit, rather than allocating
// a 64 MiB fixture. Only the constant and fs dependency are substituted; no
// production API or read implementation is replaced.
function load(io, budget = 8) {
  const declaration = 'const MAX_BYTES = 64 * 1024 * 1024;';
  assert.equal(source.split(declaration).length, 2);
  const module = { exports: {} };
  vm.runInNewContext(source.replace(declaration, `const MAX_BYTES = ${budget};`), {
    module, Buffer,
    require(name) { assert.equal(name, 'fs/promises'); return io; },
  }, { filename: sourcePath });
  return module.exports;
}

function decode(body) {
  assert.equal(body.toString('ascii', 0, 4), 'WAB1');
  const end = 8 + body.readUInt32LE(4);
  const entries = JSON.parse(body.toString('utf8', 8, end));
  let offset = end;
  const files = [];
  for (const entry of entries) {
    if ('size' in entry) {
      files.push(body.subarray(offset, offset + entry.size).toString());
      offset += entry.size;
    }
  }
  assert.equal(offset, body.length, 'framing consumes exactly the response');
  return { entries, files };
}

function fake(specs) {
  const events = [];
  return {
    events,
    async readFile() { assert.fail('unbounded readFile is forbidden'); },
    async open(name, flags) {
      events.push([name, 'open']);
      assert.equal(flags, 'r');
      const spec = specs[name];
      if (!spec || spec.openError) throw new Error('open failed');
      let position = 0;
      let calls = 0;
      return {
        async stat() {
          if (spec.statError) throw new Error('stat failed');
          return { size: spec.size ?? spec.data.length, isFile: () => !spec.directory };
        },
        async read(buffer, offset, length, filePosition) {
          events.push([name, 'read', length]);
          assert.equal(filePosition, null);
          assert.ok(length <= (spec.maxRead ?? 8), 'request exceeds remaining budget');
          if (++calls === spec.errorAt) throw new Error('read failed');
          const data = Buffer.from(spec.data);
          const count = Math.min(length, spec.shortRead ?? length, data.length - position);
          data.copy(buffer, offset, position, position + count);
          position += count;
          return { bytesRead: count };
        },
        async close() {
          events.push([name, 'close']);
          if (spec.closeError) throw new Error('close failed');
        },
      };
    },
  };
}

test('oversized opened file is rejected without reading and handle closes', async () => {
  const io = fake({ huge: { size: Number.MAX_SAFE_INTEGER, data: '' } });
  assert.deepEqual(decode(await load(io).readBundle(['huge'], f => f)), {
    entries: [{ f: 'huge', status: 413 }], files: [],
  });
  assert.deepEqual(io.events, [['huge', 'open'], ['huge', 'close']]);
});

test('growth after stat reads only budget plus one overflow byte', async () => {
  const io = fake({ growing: { size: 1, data: '0123456789abcdef', shortRead: 3 } });
  assert.deepEqual(decode(await load(io).readBundle(['growing'], f => f)).entries,
    [{ f: 'growing', status: 413 }]);
  assert.deepEqual(io.events, [
    ['growing', 'open'], ['growing', 'read', 8], ['growing', 'read', 5],
    ['growing', 'read', 2], ['growing', 'read', 1], ['growing', 'close'],
  ]);
});

test('cumulative budget, overflow recovery, zero budget and requested order', async () => {
  const io = fake({
    a: { data: 'abcde' }, over: { size: 0, data: '123456', maxRead: 3 },
    b: { data: 'XYZ', maxRead: 3 }, empty: { data: '', maxRead: 1 },
    late: { size: 0, data: '!', maxRead: 1 },
  });
  const result = decode(await load(io).readBundle(['a', 'over', 'b', 'empty', 'late'], f => f));
  assert.deepEqual(result, {
    entries: [{ f: 'a', size: 5 }, { f: 'over', status: 413 }, { f: 'b', size: 3 },
      { f: 'empty', size: 0 }, { f: 'late', status: 413 }], files: ['abcde', 'XYZ', ''],
  });
  assert.deepEqual(io.events.filter(e => e[0] === 'over' && e[1] === 'read'),
    [['over', 'read', 3], ['over', 'read', 1]]);
  assert.equal(io.events.filter(e => e[1] === 'close').length, 5);
});

test('truncation and short reads frame actual bytes, not stale stat size', async () => {
  const io = fake({ shrink: { size: 8, data: 'abc', shortRead: 1 }, next: { data: 'de' } });
  assert.deepEqual(decode(await load(io).readBundle(['shrink', 'next'], f => f)), {
    entries: [{ f: 'shrink', size: 3 }, { f: 'next', size: 2 }], files: ['abc', 'de'],
  });
});

test('large remaining budget still uses fixed-size read chunks', async () => {
  const data = 'x'.repeat(2 * 64 * 1024 + 7);
  const io = fake({ chunked: { data, shortRead: 4093, maxRead: 64 * 1024 } });
  const result = decode(await load(io, data.length).readBundle(['chunked'], f => f));
  assert.deepEqual(result.entries, [{ f: 'chunked', size: data.length }]);
  assert.deepEqual(result.files, [data]);
  assert.deepEqual(io.events.at(-2), ['chunked', 'read', 1]);
  assert.deepEqual(io.events.at(-1), ['chunked', 'close']);
});

test('replacement after opened-handle stat cannot switch the read target', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bundle-replace-'));
  try {
    const target = path.join(dir, 'target');
    await fsp.writeFile(target, 'old');
    const io = {
      async open(file, flags) {
        const handle = await fsp.open(file, flags);
        return {
          async stat() {
            const stat = await handle.stat();
            await fsp.rename(target, path.join(dir, 'original'));
            await fsp.writeFile(target, 'replacement exceeds budget');
            return stat;
          },
          read: (...args) => handle.read(...args),
          close: () => handle.close(),
        };
      },
    };
    assert.deepEqual(decode(await load(io).readBundle(['target'], () => target)), {
      entries: [{ f: 'target', size: 3 }], files: ['old'],
    });
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('open/stat/read/probe/close errors and nonregular files stay 404 and release handles', async () => {
  const specs = {
    open: { openError: true }, stat: { statError: true },
    directory: { directory: true, data: '' },
    read: { data: 'abc', shortRead: 1, errorAt: 2 },
    probe: { data: '12345678', errorAt: 2 }, close: { data: 'x', closeError: true },
    ok: { data: '12345678' },
  };
  const io = fake(specs);
  const names = ['missing', 'resolve-error', ...Object.keys(specs)];
  const result = decode(await load(io).readBundle(names, f => {
    if (f === 'resolve-error') throw new Error('resolve failed');
    return f === 'missing' ? null : f;
  }));
  assert.deepEqual(result.entries, names.map(f => f === 'ok' ? { f, size: 8 } : { f, status: 404 }));
  assert.deepEqual(result.files, ['12345678']);
  for (const name of Object.keys(specs)) {
    assert.equal(io.events.filter(e => e[0] === name && e[1] === 'close').length, name === 'open' ? 0 : 1);
  }
  assert.equal(io.events.filter(e => e[0] === 'directory' && e[1] === 'read').length, 0);
});

test('ordinary real files round trip and writeBundle sends exact framing/length', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bundle-bounded-'));
  try {
    await fsp.writeFile(path.join(dir, 'a'), 'abc');
    await fsp.writeFile(path.join(dir, 'b'), 'DEF');
    await fsp.writeFile(path.join(dir, 'empty'), '');
    const bundle = require(sourcePath);
    assert.equal(bundle.MAX_BYTES, 64 * 1024 * 1024);
    let sent;
    await bundle.writeBundle({
      writeHead(status, headers) { sent = { status, headers }; },
      end(body) { sent.body = body; },
    }, ['b', 'a', 'empty', 'absent', 'directory'], f => f === 'directory' ? dir : path.join(dir, f));
    assert.equal(sent.status, 200);
    assert.equal(sent.headers['Content-Length'], sent.body.length);
    assert.deepEqual(decode(sent.body), {
      entries: [{ f: 'b', size: 3 }, { f: 'a', size: 3 }, { f: 'empty', size: 0 },
        { f: 'absent', status: 404 }, { f: 'directory', status: 404 }], files: ['DEF', 'abc', ''],
    });
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});
