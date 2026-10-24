from work import *
def is_node(cmd):return pathlib.PurePosixPath(cmd.split(b'\0')[0].decode()).name in ('node','nodejs')
assert is_node(b'/usr/bin/node\0/tmp/task/test/run.js\0')
assert not is_node(b'python3\0-c\0node /tmp/task/test/run.js\0')
code='''import pathlib,json,os,shutil
h=pathlib.Path(ROOT);rows=[]
for d in pathlib.Path('/proc').iterdir():
 if not d.name.isdigit():continue
 try:
  cmd=(d/'cmdline').read_bytes()
  executable=pathlib.PurePosixPath(cmd.split(b'\\0')[0].decode()).name
  if executable in ('node','nodejs') and str(h).encode() in cmd:rows.append(int(d.name))
 except (OSError,ProcessLookupError):pass
assert not rows,rows
print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage('/tmp').free,ownedBytes=sum(p.stat().st_size for p in h.rglob('*') if p.is_file()),taskNode=rows,executableMatched=True)))
'''.replace('ROOT',repr(str(H)))
save('cleanup-corrected-api.json',py(code))
save('cleanup-probe-controls.json',dict(passControls=True,pythonContainingNodeRejected=True,realNodeAccepted=True,priorFalsePositive='original substring probe matched itself; original receipt retained'))
p=subprocess.run([B,'--no-update','--json','info',BOX],capture_output=True,text=True,timeout=15)
save('box-final.json',json.loads(p.stdout));assert p.returncode==0
print('cleanup PASS box retained RUNNING')
