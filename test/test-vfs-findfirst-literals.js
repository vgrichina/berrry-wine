'use strict';
// Unit tier by tools/test-tiers.js filename convention. No guest or build.
const assert = require('assert/strict');
// An explicit module path lets offline controls exercise the same real-VFS oracle.
const { VirtualFS } = require(process.argv[2] || '../lib/filesystem');

function fixture(names) {
  const vfs = new VirtualFS();
  vfs.cwd = 'c:\\game';
  vfs.ensureParentDirs('c:\\game\\nested\\placeholder');
  for (const name of names) {
    vfs.setLazyFile('c:\\game\\' + name, {
      size: 3,
      load: () => { throw new Error('enumeration must not read file bytes'); },
    });
  }
  return vfs;
}

function names(vfs, pattern) {
  const first = vfs.findFirstFile(pattern); // A SyntaxError must fail this test.
  if (!first.handle) {
    assert.equal(first.entry, null);
    return [];
  }
  const entries = [first.entry.name];
  let next;
  while ((next = vfs.findNextFile(first.handle))) entries.push(next.name);
  assert.equal(vfs.findClose(first.handle), true);
  assert.equal(vfs.findHandles.size, 0);
  return entries.sort();
}

// Legal Win32 filename punctuation: paired and unpaired regex metacharacters.
const literals = [
  ['+index_user.txt', 'index_user.txt'],
  ['a+b.txt', 'aaab.txt'],
  ['[ab].txt', 'a.txt'],
  ['a[b.txt', 'ab.txt'],
  ['a]b.txt', 'ab.txt'],
  ['(ab).txt', 'ab.txt'],
  ['a(b.txt', 'ab.txt'],
  ['a)b.txt', 'ab.txt'],
  ['$cash.txt', 'cash.txt'],
  ['^start.txt', 'start.txt'],
  ['a{2}.txt', 'aa.txt'],
  ['a{b.txt', 'ab.txt'],
  ['a}b.txt', 'ab.txt'],
  ['a.b.txt', 'axb.txt'],
];
for (const [literal, near] of literals) {
  const vfs = fixture([literal, near, 'prefix' + literal, literal + '.bak']);
  assert.deepEqual(names(vfs, literal.toUpperCase()), [literal], literal);
  assert.deepEqual(names(fixture([near]), literal), [], 'near match: ' + literal);
}

// Pipe is forbidden in ordinary Win32 names, but VFS retains it in mounted
// entries. It must not become regex alternation if such a name is queried.
assert.deepEqual(names(fixture(['a|b.txt', 'a', 'b.txt']), 'a|b.txt'), ['a|b.txt']);

const wildcard = fixture([
  '+index_user.txt', '+index_admin.txt', 'index_user.txt',
  '[ab]1.txt', '[ab]2.txt', '[ab]12.txt', 'a1.txt',
  'a+b1.txt', 'aaab1.txt', 'a+b12.txt', 'README', 'note.txt', 'nested\\note.txt',
]);
assert.deepEqual(names(wildcard, '+index_*.txt'), ['+index_admin.txt', '+index_user.txt']);
assert.deepEqual(names(wildcard, '[ab]?.txt'), ['[ab]1.txt', '[ab]2.txt']);
assert.deepEqual(names(wildcard, 'a+b?.txt'), ['a+b1.txt']);
assert.deepEqual(names(wildcard, 'a+b*.txt'), ['a+b1.txt', 'a+b12.txt']);
assert.deepEqual(names(wildcard, 'C:/GAME/+INDEX_*.TXT'), ['+index_admin.txt', '+index_user.txt']);
assert.deepEqual(names(wildcard, 'nested/../+index_user.txt'), ['+index_user.txt']);
assert.deepEqual(names(wildcard, 'missing/+index_user.txt'), []);
assert.deepEqual(names(wildcard, 'nested/*.txt'), ['note.txt']);
// Exact dot paths are resolved before matching; enumeration retains dot records.
assert.deepEqual(names(wildcard, '.'), ['game']);
assert.deepEqual(names(wildcard, '..'), ['c:\\']);
assert.deepEqual(names(wildcard, 'C:\\'), ['c:\\']);
assert.deepEqual(names(wildcard, '*.*'), names(wildcard, '*'));
assert.deepEqual(names(wildcard, '*.*').filter(n => n === '.' || n === '..'), ['.', '..']);
assert(names(wildcard, '*.*').includes('README'), 'extensionless names remain visible');
assert.deepEqual(names(wildcard, '*.txt').filter(n => n === 'note.txt'), ['note.txt']);
console.log('PASS real VirtualFS literal punctuation, near misses, wildcards, paths, roots and dot records');
