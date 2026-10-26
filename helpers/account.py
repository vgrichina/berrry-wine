import pathlib,json
B=pathlib.Path('/tmp/civ2-win16-footprint-recovered-gameplay-oct26');R=pathlib.Path('/home/user/wine-assembly/scratch/runs/civ2-win16-footprint-recovered-gameplay-oct26')
def accounting():
 a=json.loads((R/'admission.json').read_text()); entries={}
 for root in (B,R,pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/civ2-win16-footprint-recovered-gameplay-oct26')):
  entries[str(root)]=sum(p.lstat().st_blocks*512 for p in [root,*root.rglob('*')])
 for s in a['entries']:
  if '/sessions/' in s:entries[s]=pathlib.Path(s).stat().st_blocks*512
 peaks=a['walConservativeUpperBoundOnce'];p=R/'wal-peaks.json'
 if p.exists():peaks.update(json.loads(p.read_text()))
 for f in pathlib.Path('/home/user/.codex').glob('*-wal'):peaks[str(f)]=max(peaks.get(str(f),0),f.stat().st_blocks*512)
 p.write_text(json.dumps(peaks,indent=2)+'\n')
 return dict(entries=entries,walConservativeUpperBoundOnce=peaks,total=sum(entries.values())+sum(peaks.values()))
if __name__=='__main__':print(json.dumps(accounting(),indent=2))
