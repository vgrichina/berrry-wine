import pathlib,json
N='civ2-win16-map-movement-gameplay-oct26';B=pathlib.Path('/tmp')/N;R=pathlib.Path('/home/user/wine-assembly/scratch/runs')/N
def accounting():
 prior=json.load(open(R.parent/'civ2-win16-complete-setup-map-gameplay-oct26/final-accounting.json'))['accounting']
 entries={}
 for name in prior['entries']:
  root=pathlib.Path(name)
  entries[name]=sum(p.lstat().st_blocks*512 for p in [root,*root.rglob('*')]) if root.is_dir() else root.stat().st_blocks*512
 for root in [B,R,pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/N]:
  entries[str(root)]=sum(p.lstat().st_blocks*512 for p in [root,*root.rglob('*')])
 s=pathlib.Path(json.load(open(R/'accounting-inputs.json'))['session']);entries[str(s)]=s.stat().st_blocks*512
 w=R/'wal-peaks.json';peaks=json.loads(w.read_text()) if w.exists() else prior['walConservativeUpperBoundOnce'].copy()
 for f in pathlib.Path('/home/user/.codex').glob('*-wal'):peaks[str(f)]=max(peaks.get(str(f),0),f.stat().st_blocks*512)
 w.write_text(json.dumps(peaks,indent=2)+'\n')
 return dict(entries=entries,walConservativeUpperBoundOnce=peaks,total=sum(entries.values())+sum(peaks.values()),predecessorIncluded=True,walChargedOnce=True)
if __name__=='__main__':print(json.dumps(accounting(),indent=2))
