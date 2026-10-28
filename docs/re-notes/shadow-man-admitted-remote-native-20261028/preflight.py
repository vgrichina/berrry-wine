import pathlib,json,shutil,os,datetime,gzip
H=pathlib.Path('/tmp/shadow-man-admitted-remote-native-oct28');R=pathlib.Path('/home/user/wine-assembly')
D=R/'scratch/usage-watch/shadow-man-admitted-remote-native-oct28-dispatch.json'
receipt=json.loads(D.read_text());assert receipt['candidate']=='2e6f5984d3f64d7781fb02da09bbb8d564302123'
p=pathlib.Path('/home/user/wine-assembly-shadow-man-zero-transfer-canonical-native-oct23/docs/re-notes/shadow-man-zero-transfer-canonical-native-20261023')
x=json.loads(gzip.decompress((p/'candidate-inputs.json.gz').read_bytes()));assert not x['missing'];assert sum(r['bytes'] for r in x['files'])==59897543
# Each materialized source is streamed directly into place; no duplicate archive.
remote={'canonicalStandingProjection':111504363,'optionalExactNodeCopy':123656816,'oneTransferChunk':262144,'helpersFixtureLogsGitAndGrowth':12000000,'reserve':16777216}
local={'allocation':67108864,'reserve':8388608,'existingReservations':402653184,'newRemainingWorstCase':67108864}
free=shutil.disk_usage(H).free;mem=int(next(s.split()[1] for s in pathlib.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')))*1024
r={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'dispatch':str(D),'manifest':str(p/'candidate-inputs.json.gz'),'sourceFiles':len(x['files']),'sourceBytes':59897543,'remoteProjection':remote,'remoteTotal':sum(remote.values()),'remoteCap':268435456,'local':local,'hostFree':free,'hostAfterAllReservations':free-402653184-67108864,'hostFloor':2982150144,'MemAvailable':mem,'actualMountArgv':[],'intendedMountFiles':[],'plan':'one complete bash tools/build.sh; corrected static helper/guard unchanged; one fixed512MiB native arena serial; no guest mount; source/compiler receipts reused','PASS':sum(remote.values())<=268435456 and free-402653184-67108864>=2982150144}
(H/'evidence/preallocation.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:r[k] for k in ['remoteTotal','hostAfterAllReservations','MemAvailable','PASS']}));assert r['PASS']
