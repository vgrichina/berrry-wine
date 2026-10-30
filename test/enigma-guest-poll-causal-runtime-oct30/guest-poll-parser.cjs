const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const R='/tmp/enigma-original-menu-render-runtime-oct30';const source=fs.readFileSync(R+'/input-source/runner__test__run.js','utf8');
const args=JSON.parse(fs.readFileSync(R+'/guest-poll-args.json'));const start=source.indexOf('const getArg = '),end=source.indexOf('const hasFlag',start);assert(start>0&&end>start);
const parser=source.slice(start,end)+source.slice(end,source.indexOf('\n',end));
const parsed=vm.runInNewContext(parser+';({tree:getArgs("vfs-tree"),mounts:getArgs("vfs-mount"),dlls:getArgs("dlls"),exe:getArg("exe",null)})',{args});
assert.deepEqual(Array.from(parsed.tree),['/home/user/enigma-original/vfs']);assert.equal(parsed.mounts.length,0);assert.equal(parsed.dlls.length,8);
const manifest=JSON.parse(fs.readFileSync(R+'/transfer-manifest.json'));const rows=Array.isArray(manifest)?manifest:manifest.rows; console.log(JSON.stringify({manifestKeys:Object.keys(manifest).slice(0,8),parsed,parserSHA:crypto.createHash('sha256').update(parser).digest('hex')}));
