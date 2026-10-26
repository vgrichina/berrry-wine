import pathlib,subprocess,resource,json,hashlib
H=pathlib.Path('/tmp/gl-detached-peak-rss-repair-oct26'); R=H/'repo'
pins=json.loads((H/'ops/inputs.json').read_text())
def limits(): resource.setrlimit(resource.RLIMIT_DATA,(512*1048576,512*1048576))
def git(*args): return subprocess.check_output(['/usr/bin/git','-C',str(R),*args],preexec_fn=limits).decode()
print(git('init','-b','task/gl-detached-peak-rss-repair-oct26'))
(R/'.git/objects/info/alternates').write_text('/tmp/gl-browser-launch-control-repair-oct26/source/.git/objects\n')
assert git('rev-parse',pins['candidate']+'^{commit}').strip()==pins['candidate']
for f in pins['files']:
 assert git('rev-parse',pins['candidate']+':'+f['path']).strip()==f['blob']
print(git('read-tree',pins['candidate']))
print(git('checkout-index','--',*[f['path'] for f in pins['files']]))
for f in pins['files']: assert hashlib.sha256((R/f['path']).read_bytes()).hexdigest()==f['sha256']
print(git('update-ref','HEAD',pins['candidate']))
print(git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git'))
print(git('status','--short'))
(H/'ops/recovery.json').write_text(json.dumps(dict(candidate=pins['candidate'],files=pins['files'],source='immutable donor objects; sparse five-file materialization only',mountArgv=None,rootRefReceipt='/home/user/wine-assembly/scratch/usage-watch/gl-detached-peak-rss-repair-oct26/root-ref-digest.json'),indent=2))
