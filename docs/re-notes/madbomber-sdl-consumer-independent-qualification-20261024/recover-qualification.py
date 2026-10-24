"""Recover only sealed historical inputs and this reviewed fixture; never build/run.
Usage: python3 recover-qualification.py NEW_DEST READONLY_GIT_REPO REVIEW_COMMIT
Requires fresh complete resource admission, including external histories/reserve.
"""
import pathlib, subprocess, sys, json, hashlib, shutil
dest, repo, rev = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
assert not dest.exists()
assert shutil.disk_usage(dest.parent).free - 16*1048576 >= 2982150144
dest.mkdir(); log=(dest/'git-stderr.log').open('ab')
def blob(spec): return subprocess.check_output(['git','-C',repo,'show',spec],stderr=log)
prefix='docs/re-notes/madbomber-sdl-consumer-independent-qualification-20261024/'
binding=blob(rev+':'+prefix+'source-binding.json')
assert hashlib.sha256(binding).hexdigest()=='c8c7f3e6a80aaa41255c6a4e952dc442b795d5f6b8caac109791d0f603b910a0'
(dest/'source-binding.json').write_bytes(binding)
for row in json.loads(binding)['closure']:
 b=blob('b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a:'+row['path'])
 assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
 p=dest/'inputs'/row['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
for name in ['test-madbomber-sdl-error-consumer-candidate.js','system-thunk-identity.js','test-madbomber-system-thunk-identity.js']:
 (dest/name).write_bytes(blob(rev+':test/'+name))
(dest/'supervise.py').write_bytes(blob(rev+':'+prefix+'supervise.py'))
print('Recovered 41 exact historical inputs and reviewed fixture. No runtime executed.')
