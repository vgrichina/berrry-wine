const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm');
const H="/tmp/penguin-published-projectile-gameplay-oct27",argv=JSON.parse(fs.readFileSync(H+'/guest-args.json'));
const source=fs.readFileSync(H+'/runner/test/run.js','utf8');
const {expandIncludePatterns}=require(H+'/runner/lib/vfs-host-files');
const parserSource=source.slice(source.indexOf('const getArg ='),source.indexOf('const hasFlag ='));
const parsed=vm.runInNewContext(parserSource+'({trees:getArgs("vfs-tree"),dlls:getArg("dlls",null)})',{args:argv});
const trees=parsed.trees;
if(trees.length!==1||trees[0]!==H+'/game')throw Error('actual tree argv');
const rows=expandIncludePatterns(trees[0],['**/*']);
const manifest=JSON.parse(fs.readFileSync(H+'/manifest.json')).filter(x=>x.target.startsWith('game/'));
const actual=new Map(rows.map(x=>[path.relative(H,x.hostPath).replaceAll('\\','/'),x]));
if(actual.size!==manifest.length)throw Error('tree count');
for(const x of manifest){const r=actual.get(x.target);if(!r)throw Error('missing '+x.target);if(crypto.createHash('sha256').update(fs.readFileSync(r.hostPath)).digest('hex')!==x.sha256)throw Error('hash '+x.target)}
const dlls=parsed.dlls.split(',');if(dlls.length!==7||dlls.some(p=>!fs.statSync(p).isFile()))throw Error('DLL argv');
const receipt={node:process.execPath,version:process.version,execArgv:process.execArgv,argv,tree:trees[0],files:rows,commaFiles:rows.filter(x=>x.hostPath.includes(',')),dlls,parserSHA256:crypto.createHash('sha256').update(fs.readFileSync(H+'/runner/lib/vfs-host-files.js')).digest('hex'),runnerSHA256:crypto.createHash('sha256').update(source).digest('hex'),cwd:process.cwd(),memoryUsage:process.memoryUsage(),status:'PASS_EXACT_STARTUP_AND_CANONICAL_TREE_ENUMERATION'};
fs.writeFileSync(H+'/startup-mount-receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify({status:receipt.status,node:receipt.node,version:receipt.version,files:rows.length,commaFiles:receipt.commaFiles.length,dlls:dlls.length}));
