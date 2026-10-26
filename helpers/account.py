import pathlib,json
N='civ2-win16-city-founding-gameplay-oct26'; B=pathlib.Path('/tmp')/N; R=pathlib.Path('/home/user/wine-assembly/scratch/runs')/N
def size(p):
 try:return sum(f.lstat().st_blocks*512 for f in [p,*p.rglob('*')]) if p.is_dir() else p.stat().st_blocks*512
 except FileNotFoundError:return 0
def accounting():
 cfg=json.load(open(R/'accounting-inputs.json'))
 roots=[B,R,pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/N,pathlib.Path(cfg['session'])]
 entries={str(p):size(p) for p in roots}
 w=R/'wal-growth.json'; peaks=json.load(open(w)) if w.exists() else {}
 for p in pathlib.Path('/home/user/.codex').glob('*-wal'):peaks[str(p)]=max(peaks.get(str(p),0),max(0,size(p)-cfg['walBaseline'].get(str(p),0)))
 w.write_text(json.dumps(peaks,indent=2)+'\n')
 return dict(entries=entries,positiveWALGrowthOnce=peaks,total=sum(entries.values())+sum(peaks.values()),standingInputsExcluded=True)
if __name__=='__main__':print(json.dumps(accounting(),indent=2))
