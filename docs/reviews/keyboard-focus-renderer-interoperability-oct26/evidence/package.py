from common import *
admission('prepublication')
cp=json.loads((OPS/'checkpoint.json').read_text())
assert len(cp['groups'])==7 and all(x['accepted'] for x in cp['groups'])
assert sha((REPO/cp['fixture']).read_bytes())==cp['fixtureSHA256']
for pin in cp['pins']:
 b=git('show',pin['revision']+':'+pin['path'],repo=pathlib.Path(pin['donor']))
 assert sha(b)==pin['sha256']
 if pin['revision']==RENDER: assert (REPO/pin['path']).read_bytes()==b
assert git('diff','--name-only').strip()==b'', 'no tracked production changes'
doc=REPO/DOC; evidence=doc/'evidence';evidence.mkdir(parents=True,exist_ok=True)
runtime=json.loads((OPS/'resources-prepublication.json').read_text())
own=[p for p in runtime['fleet'] if 'codex exec --profile wine-worker' in p['argv'] and '/keyboard-focus-renderer-interoperability-oct26/' in p['argv']]
assert len(own)==1 and all(x in own[0]['argv'] for x in ['gpt-6.1-sol','medium','model_auto_compact_token_limit=200000','total'])
write(OPS/'launch-verified.json',{'sessionId':'01a176fe-03a1-7c80-a395-4c938ccb7241','live':own[0],'runtimeFlagsVerified':True,'actualContextCompactionNotExercised':True})
tools={}
for n in ['node','git','python3']:
 p=pathlib.Path(shutil.which(n)).resolve()
 tools[n]={'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes()),'standingInstalledExecutedInPlace':True}
write(OPS/'standing-tools.json',tools)
incident='Initial fixture assumed WM_SYSKEYUP for Alt in worker-owned route (8 PASS/4 FAIL). Source _keyMessage (renderer lines426-439) makes Alt up system only when _altTapped. Worker-owned handleKeyDown returns at lines3392-3398 before menu-tap bookkeeping at3404ff. Oracle corrected to exact WM_KEYUP and KF_ALTDOWN=0 on up, WM_SYSKEYDOWN and KF_ALTDOWN=1 on down. No source repair or held-state assertion weakening. Initial fixture/log/checkpoint retained. Existing accepted normal renderer Alt-tap case uses non-worker route. This was a fixture oracle error, not a demonstrated production defect.\n'
(OPS/'incidents.txt').write_text(incident)
readme='''# Bridge-to-renderer focus release regression

25 finite Node cases pass using real browser event listeners wired directly to
the installed renderer-input methods, real takeInput delivery, physical-state
and async polling APIs. No positive key callback wrappers/spies or mock held-key
map. DOM/event routing and timer infrastructure are fake. Each renderer owns a
fixed real 64 KiB WebAssembly.Memory and an exports ownership token; there is no
guest module, compilation, running worker, host import, or browser execution.
The real renderer queued worker-owned route is selected using its ownership set.

Inputs: renderer 0d2aaf964b31d4191a76cf84900d7433b4611fa4, browser
2b5eaa0b0db6ef12882a38b6cd143291144d4150. The four source files and test hash are
in evidence/sourcepins.json and evidence/checkpoint.json. The browser source is
an immutable evidence input, not a production replacement. Renderer, mem-utils
and region-map are inherited unchanged from the branch parent.

Coverage: all six physical modifier sides, blur and hidden cancellation (12),
both sides held and either first release followed by final blur (6), buffered
down/down/hidden/up/up delivery snapshots (3), repeats plus page-input focus
transfer, captured metadata-changing up, stale ups and fresh press (3), legacy
aggregate latch characterization (1). Scan, extended, context, transition,
previous-state and repeat-count bits are checked on actual delivered events.
Physical and queued polling timelines are separately checked. A repeated blur,
hidden event or stale up cannot manufacture another renderer release.

Two deliberate negative controls each exit 1 at the exact downstream assertion
`release must reach renderer delivery exactly once`: remove the actual bridge
blur listener, or suppress renderer keyup. They run as separate serial 16 MiB
processes using the unchanged same fixture. No positive test replaces handlers.

Aggregate pressed-since-query rearming on queued delivery is preserved and
explicitly characterized. Side latches do not rearm. No stricter aggregate-low-bit
oracle is introduced; accepted strict 3 FAIL characterization remains reused.
Alt message expectations follow the selected worker-owned queue contract; see
evidence/incidents.txt for the retained initial fixture-oracle correction.

Accepted renderer 29+37+28+25+legacy and browser supplied 19 passing receipts are
reused in evidence; none of those suites were rerun. Independent browser review
and its reentrant wake-hook cancellation case remain separately owned, outside
these groups. This fixture does not accept or refute that independent rejection.

No production edits or main publication. Coordinator owns integration against
current main and any browser/guest/runtime qualification. No box was assigned;
box ID/state/expiry are N/A and lifecycle remains coordinator-owned.
'''
(doc/'REVIEW.md').write_text(readme)
recovery='''# Reproduce

Checkout this task branch in an isolated sparse tree containing the new test,
this review directory, lib/renderer-input.js, lib/mem-utils.js and
lib/region-map.generated.js. Use the exact recorded parent source pins.
The normal tree's browser file is intentionally not used; set its immutable
input path explicitly. Run from repository root:

```sh
export BROWSER_INPUT_SOURCE="$PWD/docs/reviews/keyboard-focus-renderer-interoperability-oct26/evidence/inputs/lib/browser-input.js"
FOCUS_INTEROP_GROUP=cancellation timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
FOCUS_INTEROP_GROUP=ownership timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
FOCUS_INTEROP_GROUP=timeline timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
FOCUS_INTEROP_GROUP=focus-transfer timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
FOCUS_INTEROP_GROUP=legacy-contract timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
FOCUS_INTEROP_GROUP=negative-control FOCUS_INTEROP_NEGATIVE=bridge-release timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
FOCUS_INTEROP_GROUP=negative-control FOCUS_INTEROP_NEGATIVE=renderer-keyup timeout 20s node --max-old-space-size=16 test/keyboard-focus-renderer-interoperability-oct26.test.cjs
```

Expected positive group counts:12/6/3/3/1, all exit0. Each negative run must
exit1 and name the targeted release-delivery assertion (not an arbitrary error).
ops/test.py preserves each completed group and rechecks source/test hashes.
Only new fixture plus own review/evidence are committed; root/donor stores are
borrowed readonly via flat alternates locally and must remain available until
the verified push. Durable recovery requires only the pushed task branch, which
retains the immutable browser input; no ignored build/run artifacts are needed.

Resource gates:64 MiB task allocation includes all task Git/tree/evidence,
launcher/session bytes, future session/events/positive-WAL once and8 MiB reserve.
Projected peak56 MiB; free-after-growth>=2982150144 and RAM-after-client/heap
>=805306368. Serial Node16 MiB,20s,24 MiB individual files,128 KiB group output,
2 MiB tool capture,8192-byte excerpts. No mounts are executed, so mount argv is
empty and canonical mount parsing is inapplicable. Trusted SSH is retained in
evidence/configuration.json. Recheck admission before rerunning or publishing.
'''
(doc/'RECOVERY.md').write_text(recovery)
for p in OPS.rglob('*'):
 if p.is_file() and p.name not in ['messageboard-watch.log','watcher.pid'] and p.suffix!='.pyc' and '__pycache__' not in p.parts:
  relative=p.relative_to(OPS)
  # Setup/generation tooling is provenance, not needed to regenerate final fixture.
  target=evidence/relative; target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(p.read_bytes())
manifest={str(p.relative_to(REPO)):{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(doc.rglob('*')) if p.is_file() and p.name!='evidence-manifest.json'}
manifest[cp['fixture']]={'bytes':(REPO/cp['fixture']).stat().st_size,'sha256':cp['fixtureSHA256']}
write(doc/'evidence-manifest.json',manifest)
print('packaged',len(manifest),'payloads',own[0]['pid'])
