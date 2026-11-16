'use strict';
// A reviewed hash revision must never admit a different producer shape, an
// unreviewed baseline, or an ownership assertion. The primary census stays intact.
const assert=require('node:assert/strict');
const {check}=require('../tools/callback-ownership-census');
const base={file:'lib/example.js',name:'host-file',sha256:'a'.repeat(64),kind:'host-entry',reason:'Existing synchronous boundary',ownership:'pending'};
const current={file:base.file,name:base.name,sha256:'b'.repeat(64)};
const review={file:base.file,name:base.name,baseSHA256:base.sha256,sha256:current.sha256,reason:'Synchronous data-only change; ownership remains pending'};
const census={version:1,entries:[base]},revision=v=>({version:1,revisions:v});
assert.equal(check([current],census,revision([review])).length,0);
assert.equal(census.entries[0].sha256,'a'.repeat(64));
for(const r of [{...review,baseSHA256:'c'.repeat(64)},{...review,name:'foreign'},
  {...review,ownership:'complete'},{...review,reason:''},{...review,reason:1},
  {...review,sha256:'invalid'}])assert(check([current],census,revision([r])).length);
assert(check([current],census,revision([review,review])).length);
assert(check([{...current,writes:1}],census,revision([review])).length);
assert(check([{...current,exports:['new_entry']}],census,revision([review])).length);
assert(check([{...current,sha256:'c'.repeat(64)}],census,revision([review])).length);
assert(check([base],census,revision([review])).length);
assert(check([current],census,{version:2,revisions:[review]}).length);
console.log('14 anchored producer revision controls PASS');
