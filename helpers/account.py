import pathlib,json
N='civ2-win16-retained-intro-gameplay-oct26'
B=pathlib.Path('/tmp')/N; R=pathlib.Path('/home/user/wine-assembly/scratch/runs')/N
def accounting():
 a=json.loads((R/'accounting-inputs.json').read_text()); entries={}
 for root in (B,R,pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/N):
  entries[str(root)]=sum(p.lstat().st_blocks*512 for p in [root,*root.rglob('*')])
 p=pathlib.Path(a['session']); entries[str(p)]=p.stat().st_blocks*512
 w=R/'wal-peaks.json'; peaks=json.loads(w.read_text()) if w.exists() else {}
 for f in pathlib.Path('/home/user/.codex').glob('*-wal'):peaks[str(f)]=max(peaks.get(str(f),0),f.stat().st_blocks*512)
 w.write_text(json.dumps(peaks,indent=2)+'\n')
 return dict(entries=entries,walConservativeUpperBoundOnce=peaks,total=sum(entries.values())+sum(peaks.values()))
if __name__=='__main__': print(json.dumps(accounting(),indent=2))
