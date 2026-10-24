// Run byte-identical historical reproducer; redirect its fixed absolute donor
// paths to the private candidate. No donor mutation, no assertion changes.
const fs=require('fs'),Module=require('module');
const donor='/tmp/legacy-texture-operation-caps-oct23/repo/';
const candidate=__dirname+'/repo/';
const map=p=>typeof p==='string'&&p.startsWith(donor)?candidate+p.slice(donor.length):p;
const read=fs.readFileSync;fs.readFileSync=function(p,...a){return read.call(this,map(p),...a)};
const resolve=Module._resolveFilename;Module._resolveFilename=function(...a){return map(resolve.apply(this,a))};
