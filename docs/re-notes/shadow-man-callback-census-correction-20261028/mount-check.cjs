const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const s=fs.readFileSync('/home/user/wine-assembly-shadow-man-zero-transfer-provenance-oct23/test/run.js','utf8');
const a=s.indexOf('const getArg = (name, def) => {'),b=s.indexOf('const hasFlag',a);assert(a>0&&b>a);
const argv=['--vfs-tree=/tmp/shadow-man-callback-census-correction-oct28/ops/mount-control'];
const result=vm.runInNewContext(s.slice(a,b)+';getArgs("vfs-tree")',{args:argv});
assert.deepEqual(Array.from(result),[argv[0].slice(11)]);
assert.deepEqual(Array.from(vm.runInNewContext(s.slice(a,b)+';getArgs("vfs-tree")',{args:[]})),[]);const root=result[0];fs.mkdirSync(root,{recursive:true});fs.writeFileSync(root+'/comma,bearing.txt','control');
assert.deepEqual(fs.readdirSync(root),['comma,bearing.txt']);
console.log(JSON.stringify({sourceSHA256:crypto.createHash('sha256').update(s).digest('hex'),parserSource:s.slice(a,b),actualArgv:[],actualFilenameBearingMounts:[],controlArgv:argv,enumeratedFiles:fs.readdirSync(root),scope:'canonical parser control only; no guest or media mount invocation authorized',pass:true}));
