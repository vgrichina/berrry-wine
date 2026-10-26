from control import *
limits();signal.alarm(60);gate('preserve')
P=pathlib.Path('/tmp/maelstrom-status-event-validation-repair-oct26/ops')
old=O/'checkpoint-existing-rejection.json';shutil.copyfile(old,O/'checkpoint-existing-rejection-original-miscount.json')
v=json.loads(read(old));v['result']['groups']=14;v['correction']='Actual unchanged stdout is 14 groups/511 failure combinations; initial receipt metadata incorrectly said18; command/test not repeated.';dump(old,v)
inc=json.loads(read(O/'incidents.json'));inc['current']+=['Read attempt for predecessor ops/prepare.py returned ENOENT; used actual retained fixture/oracle paths instead. No oracle/resource change.', 'Existing rejection suite completed PASS14groups511failureCombinations; original checkpoint metadata miscounted18. Original receipt retained, atomically corrected against stdout; no test rerun.'];dump(O/'incidents.json',inc)
inputs=json.loads(read('/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/source-inputs.json'))
standing=[]
for f in inputs['files']:
 p=pathlib.Path('/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/pinned-source')/f['path'];assert sha(p)==f['sha256'];standing.append(dict(path=str(p),sha256=sha(p),bytes=p.stat().st_size,allocated=blocks(p),readonly=True))
for p in [pathlib.Path('/tmp/maelstrom-frozen-original-recovered-capture-oct25/vfs/maelstrom')/n for n in ['Maelstrom.exe','SDL_net.dll']]+[pathlib.Path('/tmp/maelstrom-frozen-original-recovered-capture-oct25/runtime/system/msvcrt.dll')]:
 standing.append(dict(path=str(p),sha256=sha(p),bytes=p.stat().st_size,allocated=blocks(p),readonly=True))
for tool in ['node','python3','git','ssh','timeout','tail','bash']:
 p=pathlib.Path(shutil.which(tool)).resolve();standing.append(dict(installedTool=tool,path=str(p),sha256=sha(p),bytes=p.stat().st_size,allocated=blocks(p),readonly=True))
dump(O/'standing-inputs.json',standing)
# Reuse only checks whose complete relevant inputs are unchanged.
unchanged=['tools/maelstrom-native-errno-latch.cjs','tools/maelstrom-select-completion-hook.cjs','test/maelstrom-native-errno-latch.test.cjs','test/maelstrom-native-errno-source-snapshot.test.cjs','test/maelstrom-select-hook-model.cjs']
pins={}
for p in unchanged:
 assert sha(R/p)==sha(DONOR/p);pins[p]=sha(R/p)
assert sha(R/'test/maelstrom-adapter-scalar-anchor.test.cjs')=='abfb36515543b9465fdf66f0b0975f18ec10c109c9eb55ad1ffef4bbd69f2bb4'
assert sha(R/'docs/reviews/maelstrom-state-acceptance-retained-closeout-oct26/remaining-independent.cjs')=='10421b75e1ed40dae8e51368537eb76b1f9aba75460cfc3831bd840d556d02e5'
for name in ['existing-latch.log','existing-source.log','preservation.json','historical-incidents.json','historical-source-incidents.json']:
 shutil.copyfile(P/name,O/('retained-'+name));pins[str(P/name)]=sha(P/name)
pres=json.loads(read(P/'preservation.json'));assert pres['passed']==1 and pres['completeTransformByteIdentical'] and pres['originalPinsAndOraclesIdentical']
for n in ['existing-latch','existing-source']:
 text=read(O/('retained-'+n+'.log')).decode();print(n,text[-1800:])
dump(O/'preservation.json',dict(unchangedInputs=pins,standingSourceManifest=sha('/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/source-inputs.json'),generatedTransform='unchanged exact JS transform/select-hook/source/binary pins; retained complete generated WAT byte-identity receipt, no regeneration/requalification',retained=['existing-latch:13groups','existing-source:6groups','complete-generated-WAT-preservation:1group'],affectedAdapterAndRejectionSuitesRerun=True,allHistoricalOraclesUnchanged=True))
checkpoint('preservation',dict(passAll=True,reused=True),unchanged,['review','publish','cleanup'])
print('preservation PASS',json.dumps(gate('preserved')))
