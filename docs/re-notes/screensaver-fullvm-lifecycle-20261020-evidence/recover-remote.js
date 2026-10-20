const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const out='/home/user/screensaver-fullvm-lifecycle-oct20',root=out+'/source';
const git=(...a)=>cp.execFileSync('git',a,{cwd:root,encoding:'utf8',maxBuffer:4*1048576}).trim();
let n=0;for(const row of git('ls-files','-s').split('\n')){const [meta,p]=row.split('\t'),b=fs.readFileSync(root+'/'+p);assert.equal(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),meta.split(' ')[1],p);n++;}
const log=fs.readFileSync(out+'/build.log','utf8');const processes=cp.execFileSync('ps',['-eo','pid,ppid,args'],{encoding:'utf8'}).split('\n').filter(s=>/node|chrome|chromium|build.sh|test\/run/.test(s)&&!s.includes('node -e'));
console.log(JSON.stringify({at:new Date().toISOString(),verifiedFiles:n,tree:git('write-tree'),moduleExists:fs.existsSync(root+'/build/wine-assembly.wasm'),log,logSha256:crypto.createHash('sha256').update(log).digest('hex'),processes},null,2));
