import pathlib,json,subprocess,os,hashlib,shutil
from preflight import O,R,old,previous,sha
b=json.loads((O/'preflight.json').read_text());assert old.seals()==b['seals'];assert previous()==b['previous'];cleanup=old.conflicts()
p=subprocess.run(['node',str(O/'transport-blocker-check.cjs')],capture_output=True,text=True)
(O/'transport-blocker-check.json').write_text(json.dumps(dict(exitCode=p.returncode,stdout=p.stdout,stderr=p.stderr),indent=2));assert p.returncode==0,p.stderr
for f in ['lib/host-imports.js','test/run.js']:
 (O/('source-'+f.replace('/','_'))).write_bytes((R/'runtime'/f).read_bytes())
log=(O/'output.log').read_text();assert '[ShellExecute] hwnd=0x0 op="WinExec" file="C:\\WINDOWS\\TEMP\\_ISTMP1.DIR\\_INS5576._MP" params=""' in log
events=[json.loads(line) for p in O.glob('*.jsonl') for line in p.read_text().splitlines()]
guest=[r for r in events if r.get('pid')==json.loads((O/'pid.json').read_text())['pid']]
assert not any(r['kind']=='fork' for r in guest);assert not list(O.glob('child-*.jsonl'))
payload=pathlib.Path('/home/user/shadow-man-real-clock-extraction-oct22/output-0.bin');assert payload.stat().st_size==557056 and sha(payload)=='a8657371f03e2e66db951c3dcd3aeb42c576894908ca2eb1b3806aa0404cb083'
exit=json.loads((O/'exit.json').read_text());assert exit['elapsedSeconds']<60
out=dict(result='BLOCKED_CLI_WINEXEC_SHELL_NOT_CONNECTED_TO_SPAWN_TRANSPORT',attempts=1,childProcesses=0,retries=0,winExecCommand='C:\\WINDOWS\\TEMP\\_ISTMP1.DIR\\_INS5576._MP',parameters='',runtimeWinExecReturn=None,sourceDerivedReturn=33,childLoad=None,childExit=None,childPayloadResolution='not reached',currentAttemptPayloadHash=None,priorAuthenticPayload=dict(path=str(payload),bytes=payload.stat().st_size,sha256=sha(payload)),originalSeals=len(b['seals']),previousSeals=len(b['previous']),preserved=True,guestEvents=guest,exit=exit,cleanup=cleanup,freeBytes=shutil.disk_usage(O).free,newBytes=sum(p.stat().st_size for p in O.rglob('*') if p.is_file()),limitations=['offline preflight missed WinExec-to-shell API routing','quiet-api without a trace consumer disabled API entry/return callbacks','no child screen; parent screenshots only','return33 demonstrated from exact callback offline, not captured guest EAX'])
(O/'analysis.json').write_text(json.dumps(out,indent=2))
manifest=[dict(path=p.relative_to(O).as_posix(),size=p.stat().st_size,sha256=sha(p)) for p in sorted(O.rglob('*')) if p.is_file()]
(O/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps({k:v for k,v in out.items() if k not in ['guestEvents','exit']}))
