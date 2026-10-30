import pathlib,json,subprocess,sys
from limit_contract import child_limits
R=pathlib.Path(__file__).parent
receipt=json.loads((R/'controller-dryrun.json').read_text())
events=receipt['traces']['catch-reset']['dispatch']
events=[{'cmd':e['cmd']} for e in events if 'cmd' in e]
# Real stdin NDJSON transport, no guest, virtual deadline trace already pinned.
q=subprocess.Popen([sys.executable,'-B','-c',"import sys,json; rows=[json.loads(s) for s in sys.stdin];assert all(set(r)=={'cmd'} for r in rows);print(json.dumps(rows))"],cwd=R,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,preexec_fn=lambda:child_limits(False))
out,err=q.communicate((''.join(json.dumps(e)+'\n' for e in events)).encode(),timeout=5)
assert q.returncode==0 and not err and json.loads(out)==events
rec={'PASS':True,'ordinaryCommandsDispatched':len(events),'stdinNDJSONExact':True,'deadlineCases':{k:max(e['at'] for e in v['dispatch']) for k,v in receipt['traces'].items()},'dryrunReceipt':str(R/'controller-dryrun.json')}
(R/'dispatch-check.json').write_text(json.dumps(rec,indent=2));print(json.dumps(rec))
