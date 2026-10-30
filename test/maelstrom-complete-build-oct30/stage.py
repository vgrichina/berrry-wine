"""Stream compressed source chunks from pinned standing inputs; no local archive."""
import sys,pathlib,json,hashlib,zlib,base64,shlex,resource
ROOT=pathlib.Path('/tmp/maelstrom-complete-transformed-module-build-oct30')
sys.path.insert(0,str(ROOT));import ops
ops.BASE=ops.configure_parent()
REPO=ROOT/'repo';HERE=pathlib.Path(__file__).parent
manifest=json.loads((ROOT/'complete-input-manifest.json').read_text())
assert hashlib.sha256((ROOT/'complete-input-manifest.json').read_bytes()).hexdigest()=='ad1b37a6ce80727902ca73c87e147e57a429bd7ad532c0981872a286f03d241f'
launch=dict(mountArgv=[],intendedGuestFiles=[],canonicalParser='No filename-bearing guest mount arguments: direct API staging only. No guest mount parser is invoked.',trustedGitSSH=ops.SSH,manifestSHA256='ad1b37a6ce80727902ca73c87e147e57a429bd7ad532c0981872a286f03d241f')
(ROOT/'launch-configuration.json').write_text(json.dumps(launch,indent=2))
assert 'StrictHostKeyChecking=yes' in ops.SSH
def remote(name,script,timeout='60',detach=False):
 argv=['/home/user/.ascii/boat','exec','bx_ssjeeb8p','--timeout',timeout,'--json']+(['--detach'] if detach else [])+['--','bash','-c',script]
 rc,out=ops.run(name,argv,cwd=REPO);assert rc==0,name
 data=json.loads(out);assert data.get('success',False) and not data.get('stdoutTruncated') and not data.get('stderrTruncated'),data
 return data
if sys.argv[1]=='stage':
 # All standing inputs exist and hash correctly before any scarce build.
 for i in manifest['items']:
  b=pathlib.Path(i['source']).read_bytes();assert len(b)==i['bytes'] and hashlib.sha256(b).hexdigest()==i['sha256'],i['path']
 # Reserve is physically allocated and retained through snapshot/closeout.
 with (ROOT/'publication-reserve').open('wb') as f:
  for _ in range(8):f.write(bytes(1048576))
 localitems=[dict(path=i['path'],source=i['source'],bytes=i['bytes'],sha256=i['sha256']) for i in manifest['items']]
 for p in ['build.cjs','supervise.cjs']:
  b=(HERE/p).read_bytes();localitems.append(dict(path=p,source=str(HERE/p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest()))
 # Manifest is transferred directly, byte-for-byte.
 p=ROOT/'complete-input-manifest.json';b=p.read_bytes();localitems.append(dict(path='manifest.json',source=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest()))
 batches=[];batch=[];size=0
 for i in localitems:
  data=pathlib.Path(i['source']).read_bytes();encoded=base64.b64encode(zlib.compress(data,6)).decode()
  for off in range(0,len(encoded),60000):
   part=dict(path=i['path'],data=encoded[off:off+60000],first=off==0,last=off+60000>=len(encoded),sha256=i['sha256'],bytes=i['bytes'])
   n=len(json.dumps(part))
   if size+n>85000:batches.append(batch);batch=[];size=0
   batch.append(part);size+=n
 if batch:batches.append(batch)
 for idx,batch in enumerate(batches):
  # Reconstruct a single compressed file at a time remotely. No local payload copy.
  js="const fs=require('fs'),z=require('zlib'),c=require('crypto');process.chdir('/tmp/maelbuild');function allocated(p){const s=fs.lstatSync(p);return s.blocks*512+(s.isDirectory()?fs.readdirSync(p).reduce((n,f)=>n+allocated(p+'/'+f),0):0)}if(Number(fs.readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\\s+(\\d+)/m)[1])*1024<2304*1048576||allocated('.')>240*1048576)throw Error('stage admission');const parts="+json.dumps(batch)+";for(const p of parts){if(p.path.includes('..')||p.path.startsWith('/'))throw Error('path');fs.mkdirSync(require('path').dirname(p.path),{recursive:true});const t=p.path+'.z';fs.writeFileSync(t,p.data,{flag:p.first?'w':'a'});if(p.last){const b=z.inflateSync(Buffer.from(fs.readFileSync(t,'utf8'),'base64'));if(b.length!==p.bytes||c.createHash('sha256').update(b).digest('hex')!==p.sha256)throw Error('hash '+p.path);fs.writeFileSync(p.path,b);fs.unlinkSync(t);}}console.log(JSON.stringify({batch:"+str(idx)+",parts:parts.length}));"
  remote('stage-%02d'%idx,"cd /tmp/maelbuild && ulimit -t 180 && ulimit -f 65536 && node --max-old-space-size=192 -e "+shlex.quote(js))
 remote('remote-reserve',"cd /tmp/maelbuild && node --max-old-space-size=192 -e 'const fs=require(\"fs\");const f=fs.openSync(\"reserve\",\"wx\");for(let i=0;i<16;i++)fs.writeSync(f,Buffer.alloc(1048576));fs.closeSync(f);console.log(\"reserved 16MiB\")'")
 print(json.dumps({'stagedItems':len(localitems),'batches':len(batches)}))
elif sys.argv[1]=='startup':remote('remote-startup','cd /tmp/maelbuild && ulimit -t 180 && ulimit -f 65536 && node --max-old-space-size=192 supervise.cjs --startup')
elif sys.argv[1]=='build':
 # Detached remote supervisor enforces its own wall/RSS/capture constraints.
 rc,out=ops.run('remote-build-launch-corrected',['/home/user/.ascii/boat','exec','bx_ssjeeb8p','--json','--detach','--','bash','-c','cd /tmp/maelbuild && ulimit -t 180 && ulimit -f 65536 && node --max-old-space-size=192 supervise.cjs'],cwd=REPO);assert rc==0
