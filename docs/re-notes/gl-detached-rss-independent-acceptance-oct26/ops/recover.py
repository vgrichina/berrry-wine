import pathlib,subprocess,resource,json,hashlib
H=pathlib.Path('/tmp/gl-detached-rss-independent-acceptance-oct26');R=H/'repo'
def lim():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
def g(*a,**kw):return subprocess.check_output(['/usr/bin/git','-C',str(R),*a],preexec_fn=lim,**kw)
print(g('init','-b','task/gl-detached-rss-independent-acceptance-oct26').decode())
(R/'.git/objects/info/alternates').write_text('/tmp/gl-detached-peak-rss-repair-oct26/repo/.git/objects\n')
pins=json.loads((H/'ops/inputs.json').read_text());c=pins['candidate']
assert g('rev-parse',c+'^{commit}').decode().strip()==c
g('read-tree',c);g('update-index','--skip-worktree','-z','--stdin',input=g('ls-files','-z'))
for f in pins['sourcePins']:
 p=f['path'].split('/repo/')[1];data=g('show',c+':'+p)
 assert hashlib.sha256(data).hexdigest()==f['sha256']
 (R/p).parent.mkdir(parents=True,exist_ok=True);(R/p).write_bytes(data)
 g('update-index','--no-skip-worktree','--',p)
g('update-ref','HEAD',c);g('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
print(g('status','--short').decode())
