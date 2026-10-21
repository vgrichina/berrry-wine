const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const root='/home/user/jedi-current-main',out='/home/user/jedi-evidence',assets='/home/user/jedi-original';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const save=(p,v)=>fs.writeFileSync(out+'/'+p,JSON.stringify(v,null,2));
const rows=cp.execFileSync('git',['ls-tree','-r','HEAD'],{cwd:root,encoding:'utf8'}).trim().split('\n').map(l=>{let [m,p]=l.split('\t');return {path:p,oid:m.split(' ')[2]};});
for(const r of rows){const b=fs.readFileSync(root+'/'+r.path);assert.equal(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),r.oid,r.path);r.sha256=sha(b);}
assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),'fe49a84e745015ecdbe752e028235924ef4324dc');
const moduleHash=sha(fs.readFileSync(root+'/build/wine-assembly.wasm'));assert.equal(moduleHash,'728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c');
save('source-manifest.json',{commit:'fe49a84e745015ecdbe752e028235924ef4324dc',files:rows,moduleHash,node:process.version,at:new Date().toISOString()});
const {fontMounts,BUNDLED_BITMAP_FONTS}=require(root+'/lib/font-substitutions');const {SYSTEM_DATA_FILES}=require(root+'/lib/process-boot');
const support=[...SYSTEM_DATA_FILES.map(x=>({host:root+'/'+x.url,guest:x.path||x.guestPath})),...BUNDLED_BITMAP_FONTS.map(x=>({host:root+'/fonts/'+x,guest:'c:\\windows\\fonts\\'+x.toLowerCase()})),...fontMounts(JSON.parse(fs.readFileSync(root+'/fonts/substitutions.json')),{subset:true}).map(x=>({host:root+'/fonts/'+x.file,guest:x.vfsPath}))].map(x=>({...x,bytes:fs.statSync(x.host).size,sha256:sha(fs.readFileSync(x.host))}));
save('host-support.json',support);console.log('Exact source files',rows.length,'support',support.length,'module',moduleHash);
fs.mkdirSync(out+'/bootstrap',{recursive:true});
const args=['test/run.js','--exe='+assets+'/original/setup.exe','--no-build','--wasm='+root+'/build/wine-assembly.wasm','--quiet-api','--quiet-blocks','--no-close','--no-threads','--batch-size=200000','--max-batches=10000000','--max-seconds=120','--vfs-tree='+assets+'/original','--capture-launch='+out+'/capture','--save-vfs='+out+'/bootstrap/vfs','--reg-export='+out+'/bootstrap/registry.json','--png='+out+'/bootstrap/final.png'];
save('bootstrap/launch.json',{at:new Date().toISOString(),cwd:root,args,inputs:[]});
const r=cp.spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:4*1048576});fs.writeFileSync(out+'/bootstrap/output.log',(r.stdout||'')+(r.stderr||''));save('bootstrap/terminal.json',{status:r.status,signal:r.signal,error:r.error?.message,at:new Date().toISOString()});console.log((r.stdout||'').slice(-4000),r.stderr);assert.equal(r.status,0);console.log(fs.readFileSync(out+'/capture/launch.json','utf8'));
