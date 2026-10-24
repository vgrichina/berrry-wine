"""Materialize explicit historical closure from read-only Git objects, no build.
Run only inside a newly admitted task allocation. Arguments: DEST GIT_REPO TASK_REV.
"""
import pathlib,subprocess,sys,json,hashlib,shutil
dest,repo,revision=pathlib.Path(sys.argv[1]),sys.argv[2],sys.argv[3]
assert not dest.exists(), 'fresh destination required'
assert shutil.disk_usage(dest.parent).free-16*1048576>=2982150144
dest.mkdir(); log=(dest/'git-stderr.log').open('ab')
def blob(spec):return subprocess.check_output(['git','-C',repo,'show',spec],stderr=log)
prefix='docs/re-notes/madbomber-authentic-sdl-error-consumer-20261024/'
binding=blob(revision+':'+prefix+'source-binding.json')
assert hashlib.sha256(binding).hexdigest()=='c8c7f3e6a80aaa41255c6a4e952dc442b795d5f6b8caac109791d0f603b910a0'
(dest/'source-binding.json').write_bytes(binding)
rows=json.loads(binding)['closure']
for row in rows:
 data=blob('b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a:'+row['path'])
 assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
 p=dest/'inputs'/row['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
for name in ['inspect.cjs','supervise.py','consumer-static.json','verify-static.py']:
 (dest/name).write_bytes(blob(revision+':'+prefix+name))
(dest/'test-madbomber-sdl-error-consumer-candidate.js').write_bytes(blob(revision+':test/test-madbomber-sdl-error-consumer-candidate.js'))
print(json.dumps({'sourceFiles':len(rows),'sourceBytes':sum(x['bytes'] for x in rows),'destination':str(dest),'runtimeExecuted':False,'requiresFreshCompleteTaskAdmission':True}))
