const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const H=__dirname, source=fs.readFileSync(path.join(H,'runner/test/run.js'),'utf8');
const parser=source.slice(source.indexOf('const getArg ='),source.indexOf('// Was `--name=...`'));
assert(parser.includes(".split(',')"));
const full=JSON.parse(fs.readFileSync(path.join(H,'guest-args.json')));
function parse(argv){return vm.runInNewContext(parser+';({trees:getArgs("vfs-tree"),mounts:getArgs("vfs-mount"),dlls:getArgs("dlls"),cwd:getArg("cwd"),exe:getArg("exe"),guestExe:getArg("exe-guest-path"),env:getArgs("env"),input:getArg("input"),limit:+getArg("max-batches"),quiet:hasFlag("quiet-api")&&hasFlag("quiet-blocks"),noBuild:hasFlag("no-build"),wasm:getArg("wasm")})',{args:argv});}
const p=parse(full.slice(4));assert.equal(p.trees.length,1);assert.equal(p.mounts.length,0);assert(p.noBuild&&p.quiet);assert.equal(p.cwd,'C:\\maelstrom');assert.equal(p.guestExe,'C:\\maelstrom\\Maelstrom.exe');assert.equal(p.dlls.length,3);p.dlls.forEach(f=>fs.statSync(f));assert(p.env.includes('HOME=.'));assert(p.env.includes('MAELSTROM_LIB=.'));
const {expandIncludePatterns,guestPathInTree}=require('./runner/lib/vfs-host-files');
const manifest=JSON.parse(fs.readFileSync(path.join(H,'manifest.json'))), expected=manifest.filter(x=>x.target.startsWith('vfs/'));
assert.equal(expected.length,48);assert.deepEqual(fs.readdirSync(p.trees[0]),['maelstrom']);
const files=expandIncludePatterns(p.trees[0],['**/*']);
function validate(rows){assert.equal(rows.length,48);const actual=rows.map(f=>({host:f.hostPath,guest:'C:\\'+f.guestPath.replaceAll('/','\\')}));for(const e of expected){const f=actual.find(f=>f.host===path.join(H,e.target));assert(f,e.target);assert.equal(f.guest,'C:\\'+e.target.slice(4).replaceAll('/','\\'));assert.equal(f.guest,guestPathInTree(p.trees[0],f.host));const bytes=fs.readFileSync(f.host);assert.equal(bytes.length,e.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),e.sha256);}return actual;}
const mapping=validate(files);
assert.throws(()=>validate(files.slice(1)));
assert.throws(()=>validate(files.map((f,i)=>i?f:{...f,guestPath:'wrong\\asset'})));
const bad=parse(['--vfs-mount='+path.join(H,'vfs/maelstrom/Docs/Ambrosia_Software,_Inc._FAQ.txt')+'=C:\\maelstrom\\Docs\\Ambrosia_Software,_Inc._FAQ.txt']);assert(bad.mounts.some(s=>s.lastIndexOf('=')<=0));
const schedule=p.input.split(',').map(s=>({batch:+s.split(':')[0],action:s.split(':')[1]}));assert(schedule.every(s=>s.batch<p.limit));assert(schedule.some(s=>s.action==='keydown'));assert.equal(schedule.filter(s=>s.action==='png').length,3);assert.equal(p.limit,42000);
const result={pass:true,canonicalParserSHA256:crypto.createHash('sha256').update(parser).digest('hex'),fullArgv:true,treeOnlyMaelstrom:true,files:48,mapping,brokenCommaRejected:true,wrongRootRejected:true,missingFileRejected:true,schedule,limit:p.limit,guestInvoked:false};
fs.writeFileSync(path.join(H,'tree-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,mapping:'48 hashed mappings retained'}));
