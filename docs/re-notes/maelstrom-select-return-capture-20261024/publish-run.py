from work import *
R=H/'repo';E=R/'docs/re-notes/maelstrom-select-return-capture-20261024';runid='20261024T083020Z-maelstrom-select-return-capture';U=R/'scratch/runs'/runid;U.mkdir(parents=True,exist_ok=True)
# Artifacts are ordinary copies owned by this run, no external artifact links.
for name in ['output.log','command.json','terminal.json'] :shutil.copyfile(H/'collected/guest'/name,U/name)
for name in ['analysis.json','box-handback.json']:shutil.copyfile(H/name,U/name)
for name in ['menu.png','play.png','input.png']:shutil.copyfile(H/'collected/guest'/name,U/name)
command=json.load(open(U/'command.json'))
result=dict(candidateId='maelstrom-original-win32-3.0.6',registeredCandidate=False,agentId='codex:'+os.environ['CODEX_SESSION_ID'],startedAt='2026-10-24T08:30:20.203Z',finishedAt='2026-10-24T08:30:30.354Z',outcome='passed',route='first-post-P-RunFrame-select-return-diagnostic',command=command['argv'],build=dict(commit='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a',dirtyPatchSha256=None,wasmSha256='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'),environment=dict(host='bx_ktknkc9m',mode='headless',node='v24.22.1',uid=1000,renderer='retained canonical software canvas',arenaMiB=512,nodeHeapMiB=512,harnessSHA256='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'),summary='Diagnostic only: select return count0/1/3 at two ten-batch intervals,972 at41999; PollEvent3 fixed, actual Sync1. Disproves single parked select and prior noSync inference. No defect/gameplay acceptance. PNGs preserved but unreviewed.',verification='unreviewed',screenshots=['menu.png','play.png','input.png'],artifacts=['output.log','command.json','terminal.json','analysis.json','box-handback.json'])
# Metadata published last after all run artifacts.
(U/'result.json.tmp').write_text(json.dumps(result,indent=2)+'\n');(U/'result.json.tmp').rename(U/'result.json')
(E/'result.json').write_text(json.dumps(result,indent=2)+'\n')
save('run-location.json',dict(runid=runid,path=str(U)))
print(runid)
