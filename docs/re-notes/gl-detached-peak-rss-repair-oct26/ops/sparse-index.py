import subprocess,resource,json,pathlib
H=pathlib.Path('/tmp/gl-detached-peak-rss-repair-oct26');R=H/'repo'
def limits():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
def git(args,**kw):return subprocess.check_output(['/usr/bin/git','-C',str(R),*args],preexec_fn=limits,**kw)
files=git(['ls-files','-z'])
git(['update-index','--skip-worktree','-z','--stdin'],input=files)
pins=json.loads((H/'ops/inputs.json').read_text())
git(['update-index','--no-skip-worktree','--',*[f['path'] for f in pins['files']]])
print(git(['status','--short']).decode())
print(git(['diff','--check']).decode())
print(git(['diff','--stat']).decode())
print(git(['diff','--','test/helpers/palette-browser-supervisor.py','test/test-palette-browser-supervisor.py']).decode())
