from common import *
import datetime
gate('final-resources')
j=json.load(open(O/'admission-final-resources.json'))
compressed=alloc(O/'payload.tar.gz');git=alloc(R/'.git');publication=alloc(R/'docs');modules=alloc(H/'modules');reports=alloc(O)-compressed
measured=dict(compressedSelective=compressed,minimalEvidenceGit=git,retainedModulesAndReports=modules+reports,sessionEventsPositiveWAL=sum(j['actual'][x] for x in ['launcher','session','positiveWAL']),publicationMaterialized=publication,taskDirectoryMetadata=max(0,alloc(H)-compressed-git-modules-reports-publication))
caps=dict(compressedSelective=8*1048576,minimalEvidenceGit=16*1048576,retainedModulesAndReports=16*1048576,sessionEventsPositiveWAL=16*1048576,publicationMaterialized=16*1048576)
assert all(measured[n]<=cap for n,cap in caps.items()),measured
tools={}
for cmd in ['python3','boat']:
 p=pathlib.Path(shutil.which(cmd)).resolve();tools[cmd]=dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes()),newCopy=False)
remote=json.load(open(O/'remote-closeout.json'));r=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),local=j,categories=measured,categoryCeilings=caps,allFutureGrowthAnd8MiBReserveInsideRemainingAllowance=True,standingTools=tools,standingReadonlyDonors='input-manifest absolute paths; excluded from new copies, exact hashes retained',remote=remote,localPermits='pool1/128MiB whole physical for tests/transport; pool2 before Git mutex/256MiB physical; DATA512MiB Git subprocess only',positiveWALBaseline=json.load(open(O/'db-baseline.json')))
save('final-resources.json',r);print(json.dumps(dict(categories=measured,used=j['used'],allocation=j['allocation'],projectedFree=j['projectedFree'],floor=j['floor'],memAvailable=j['memAvailable'],required=j['requiredMemory'],remoteAllocated=remote['allocatedBytes'])))
