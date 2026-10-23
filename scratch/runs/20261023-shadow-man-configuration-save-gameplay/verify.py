"""Offline handback verification; no runtime, credential or lifecycle access."""
import pathlib,json,subprocess,hashlib,os,shutil
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2]
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
 expected={l.split('\t')[1]:l.split('\t')[0] for l in (E/'base-index.txt').read_text().splitlines()}
 actual={l.split('\t')[1]:l.split('\t')[0] for l in subprocess.check_output(['git','ls-files','--stage'],cwd=W,env=dict(os.environ,GIT_NO_LAZY_FETCH='1')).decode().splitlines()}
 assert all(actual.get(p)==v for p,v in expected.items()),'Base path changed'
 rows=[json.loads(l) for l in (E/'transfer-files.jsonl').read_text().splitlines()]
 accepted=json.loads((E/'full-accepted-manifest.json').read_text());by={x['path']:x for x in accepted}
 assert all(x['bytes']==by[x['path']]['bytes'] and x['sha256']==by[x['path']]['sha256'] for x in rows)
 assert len({x['path'] for x in rows})==len(rows)
 a=json.loads((E/'admission.json').read_text());own=int(subprocess.check_output(['du','-s','-B1',str(W)]).split()[0]);total=a['selectedAllocated']+own+a['toolsAndGitAllowance']+a['reserve'];assert total<a['cap'] and shutil.disk_usage(W).free>a['hostFloor']
 artifacts={p.name:dict(bytes=p.stat().st_size,sha256=sha(p)) for p in E.iterdir() if p.is_file() and p.name not in ['verification.json','artifact-manifest.json','publication.json']}
 if (E/'transfer-complete.json').exists():assert len(rows)==2083 and sum(x['bytes'] for x in rows)==186399681
 sessions=[]
 for p in sorted(E.glob('session?-fixed-session-result.json')):
  s=json.loads(p.read_text());assert s['boundPassed'] and s['elapsedSeconds']<=90 and s['remaining']==[];sessions.append(s)
 assert len(sessions)<=3
 if (E/'handback.json').exists():
  h=json.loads((E/'handback.json').read_text());assert h['ownedNodeProcesses']==[] and h['box']=='bx_fn7pn7yg'
 result=dict(passAll=True,basePreserved=len(expected),verifiedTransferFiles=len(rows),verifiedTransferBytes=sum(x['bytes'] for x in rows),sessions=len(sessions),localAllocatedWithToolsReserve=total,hostFree=shutil.disk_usage(W).free,artifacts=artifacts)
 (E/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='artifacts'}))
if __name__=='__main__':main()
