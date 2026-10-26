import pathlib,json,datetime
B=pathlib.Path('/tmp/civ2-win16-ordinary-gameplay-oct26');R=pathlib.Path('/home/user/wine-assembly/scratch/runs/civ2-win16-ordinary-gameplay-oct26')
START=datetime.datetime.fromisoformat('2026-10-26T20:52:59+00:00').timestamp()
def accounting():
 roots=[B,R,pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/civ2-win16-ordinary-gameplay-oct26')]
 entries={str(r):sum(p.lstat().st_blocks*512 for p in [r,*r.rglob('*')]) for r in roots}
 s=pathlib.Path('/home/user/.codex/sessions/2026/10/26/rollout-2026-10-26T20-52-59-01a179fc-e62f-7ce0-bc25-61a111761194.jsonl');entries[str(s)]=s.stat().st_blocks*512
 # No pre-task WAL baseline was captured. Conservatively charge the ENTIRE
 # current allocated WAL for every WAL touched since task start, once each.
 # Unmodified pre-task standing WAL is not new task allocation.
 wal={str(p):p.stat().st_blocks*512 for p in pathlib.Path('/home/user/.codex').glob('*-wal') if p.stat().st_mtime>=START}
 previous=R/'wal-peaks-live.json'
 peaks=json.loads(previous.read_text()) if previous.exists() else {}
 for p,n in wal.items():peaks[p]=max(n,peaks.get(p,0))
 previous.write_text(json.dumps(peaks,indent=2)+'\n')
 return dict(entries=entries,walConservativeUpperBoundOnce=peaks,total=sum(entries.values())+sum(peaks.values()),note='Charges full touched WAL, not only growth, because initial WAL baseline unavailable. Symlink targets standing assets excluded; source included. Future session/events/publication and 8MiB reserve must fit remaining cap.')
if __name__=='__main__':print(json.dumps(accounting(),indent=2))
