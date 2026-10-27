const fs=require('fs'),path=require('path'),crypto=require('crypto');
const O='/tmp/gta2-fullscreen-mode-cause-repair-oct27/ops';
const runner=fs.readFileSync(O+'/canonical-runner.txt','utf8'),start=runner.indexOf('const getArg = '),end=runner.indexOf('const hasFlag = ',start);if(start<0||end<=start)throw Error('parser boundary');
const parser=runner.slice(start,end),args=['--app=gta2_demo','--vfs-tree=/home/user/wine-assembly/test/binaries/candidates/gta2-demo/installed/Program_Executable_Files'];
const parsed=new Function('args',parser+'return {trees:getArgs("vfs-tree"),app:getArg("app",null)}')(args);
if(parsed.app!=='gta2_demo'||parsed.trees.length!==1||parsed.trees[0]!==args[1].slice(11))throw Error('parser mismatch');
const files=[];function walk(p){for(const d of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,d.name);if(d.isDirectory())walk(q);else if(d.isFile())files.push({path:q,bytes:fs.statSync(q).size});else throw Error('unsupported member '+q);}}walk(parsed.trees[0]);
fs.writeFileSync(O+'/mount-validation.json',JSON.stringify({args,parsed,parserSHA256:crypto.createHash('sha256').update(parser).digest('hex'),files,commaFiles:files.filter(x=>x.path.includes(',')),actualTaskMountArgv:[],runtimeAuthorized:false,explanation:'Offline static analysis task; canonical tree parser validated against intended retained game tree, no guest invocation'},null,2));console.log('PASS canonical tree parser enumerated '+files.length+' filenames');
