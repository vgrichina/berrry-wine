from supervisor import *
import datetime
files=['analyze.py','contract.py','supervisor.py','test_contract.py','materialize-source.py','run-contract.py','run-tests.py','report.md','contract-evidence.json','input-source-pins.json','extra-source-pins.json','initial-receipt.json','sentinel-receipt.json','source-transfer-cleanup.json']
for f in files:
 p=OUT/f;assert p.is_file() and p.stat().st_size<1024**2
admission('publication-footprint')
# Retain focused current accounting without rescanning any predecessor payload.
initial=json.loads((OUT/'initial-receipt.json').read_text());growth=0
for x in initial['sharedWALBaselineCountedOnce']:
 p=pathlib.Path(x['path']);growth+=max(0,(p.stat().st_size if p.exists() else 0)-x['bytes'])
owned=sum(p.stat().st_size for p in OWN.rglob('*') if p.is_file());session=pathlib.Path(initial['session']);event=pathlib.Path(initial['sessionEvents']);external=sum(p.stat().st_size for p in [session,event] if p.exists())
projection=13225945+owned+external+growth+3*1024**2+15*1024**2
save('publication-footprint.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'ownedLogicalBytes':owned,'retainedPayloadCountedOnce':13225945,'sessionEventsBytes':external,'positiveSharedWALGrowthCountedOnce':growth,'publicationReserve':3*1024**2,'uncertaintyBuffer':15*1024**2,'projection':projection,'allocation':50331648,'retainedAllocation':True,'PASS':projection<=50331648})
if projection>50331648:raise RuntimeError('FIRST ALLOCATION ADMISSION FAILURE')
args=['git','-C',str(OWN),'add','--']+[str((OUT/f).relative_to(OWN)) for f in files]
run(args,cwd=OWN,git=True,mutate=True,label='publication-add')
review=run(['git','-C',str(OWN),'diff','--cached','--stat'],cwd=OWN,git=True,label='publication-review')
print(review.decode()[:3000])
run(['git','-C',str(OWN),'diff','--cached','--check'],cwd=OWN,git=True,label='publication-diff-check')
# Explicit staged path allowlist protects the pinned base and all unrelated paths.
staged=run(['git','-C',str(OWN),'diff','--cached','--name-only'],cwd=OWN,git=True,label='publication-paths').decode().splitlines()
assert sorted(staged)==sorted(str((OUT/f).relative_to(OWN)) for f in files)
run(['git','-C',str(OWN),'commit','-m','test: pin original TuxRacer PE startup import contract'],cwd=OWN,git=True,mutate=True,label='publication-commit')
sha=run(['git','-C',str(OWN),'rev-parse','HEAD'],cwd=OWN,git=True,label='publication-head').decode().strip();branch='task/'+TASK
run(['git','-C',str(OWN),'push','origin','HEAD:refs/heads/'+branch],cwd=OWN,git=True,mutate=True,label='publication-push')
remote=run(['git','-C',str(OWN),'ls-remote','--exit-code','origin','refs/heads/'+branch],cwd=OWN,git=True,label='publication-remote').decode().strip()
assert remote==sha+'\trefs/heads/'+branch
save('publication.json',{'commit':sha,'branch':branch,'remoteVerified':remote,'mainPushed':False,'force':False,'trustedSsh':SSH})
print(json.dumps({'commit':sha,'branch':branch,'remoteVerified':True}))
