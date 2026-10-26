from control import *
import difflib
old=pathlib.Path('/tmp/alien-render-wait-accepted-main-integration-oct26/integration-source')
source=(R/'test/run.js').read_text()
s=source.replace("  // --trace-render-wait: opt in to bounded software-D3D wait attribution.\n  // Legacy render-park waits/counters remain active without this diagnostic.\n",'')
s=s.replace("hasFlag('trace-render-wait') ? createRenderWaitAttribution() : null",'createRenderWaitAttribution()')
s=s.replace('if (renderWaitAttribution) ctx.renderWaitAttribution = renderWaitAttribution.stats;','ctx.renderWaitAttribution = renderWaitAttribution.stats;')
s=s.replace('renderWaitAttribution?.','renderWaitAttribution.')
assert s==(old/'test/run.js').read_text(),'Only explicit gate/optional diagnostic calls changed'
unchanged=['lib/render-wait-attribution.js','lib/d3d9-host.js','lib/host-imports.js','test/fixtures/render-park-control.json']
for n in unchanged:assert (R/n).read_bytes()==(old/n).read_bytes(),n
# The original schedules/assertions remain byte-identical. Only extraction
# anchors, opt-in selection and omission-pattern syntax must follow the new gate.
t=(R/'test/test-render-wait-attribution.js').read_text()
t=t.replace('"  const renderWaitAttribution = hasFlag(\'trace-render-wait\') ? createRenderWaitAttribution() : null;"',"'  const renderWaitAttribution = createRenderWaitAttribution();'")
t=t.replace('renderWaitAttribution?.','renderWaitAttribution.').replace('renderWaitAttribution\\?\\.parkEnd','renderWaitAttribution\\.parkEnd')
t=t.replace("hasFlag: name => name === 'trace-render-wait'",'hasFlag: () => false')
assert t==(old/'test/test-render-wait-attribution.js').read_text(),'Schedule bodies unchanged'
repro=O/'default-off-contract.js'
assert sha(repro)=='8cab353dd84e9682a9b2a75d7c87ec454af303c4937b740a120e7ead8d25b0b7'
# Compare complete actual legacy hook/terminal text to the baseline after
# removing diagnostic code; the prior independent acceptance already proves
# candidate-minus-diagnostics equals this pinned baseline.
receipt=dict(candidate=CAND,runnerSHA256=sha(R/'test/run.js'),repairedTestSHA256=sha(R/'test/test-render-wait-attribution.js'),unchanged={n:sha(R/n) for n in unchanged},inverseGateDeltaExact=True,originalScheduleBodiesExact=True,reproducerSHA256=sha(repro),reuse=dict(independentCommit='b3e97bef1c554719d95a07438ced8bb818dbeb61',checkpoint='/tmp/alien-render-wait-measured-client-accept-oct26/ops/checkpoint.json',checkpointSHA256=sha(pathlib.Path('/tmp/alien-render-wait-measured-client-accept-oct26/ops/checkpoint.json')),donor12000='/tmp/alien-shooter-render-wait-attribution-oct26/ops/acceptance.json',donor12000SHA256=sha(pathlib.Path('/tmp/alien-shooter-render-wait-attribution-oct26/ops/acceptance.json'))),limits='Reused receipts keep original physical-supervision qualifications; no retrospective requalification')
save('reuse-identities.json',receipt)
cp=json.loads((O/'checkpoint.json').read_text());cp['completed']+=['inverse-gate-delta-and-original-schedule-body-identities'];cp['remaining']=['review-and-branch-publication'];save('checkpoint.json',cp)
print('PASS exact inverse runner delta; four unchanged source bodies; original schedules unchanged; rejection reproducer unchanged; prior receipts reused')
