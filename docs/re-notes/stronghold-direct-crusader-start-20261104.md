# Stronghold direct Crusader route: stopped during startup

**Actual world entry was not achieved.** The single browser attempt stopped at the first unexpected startup checkpoint: at step **6144**, the personally viewed fresh capture still showed the original loading artwork and an approximately one-third progress bar. The predecessor showed the Firefly splash at that checkpoint. No guest key or mouse input, Crusader selection, scenario Start, recruitment or hostile engagement was sent. This is an observed checkpoint divergence, not an established hang or production defect.

Evidence: `scratch/runs/20261104-stronghold-direct-crusader-start/`. Task input was main **7bea5e70620c377923346e9ff47ca5f1768d0281**. The [corrected route and integration](stronghold-corrected-native-start-20261104.md) supplied the unchanged native guard from **6004e338eeecbdac153284cd363d499843bc68a4** and immutable boundary from **eef09d6881329f916577eb6ac78e93e36f398d6d**. Both staged guard files were compared byte-for-byte with their durable originals. Their queue, review, exact scene, geometry, native `(718,569)` and failure predicates were preserved.

## Tested run-only dependency corrections

The inherited navigation parser and driver required integer browser coordinates. The tested native Crusader `(304,144)` projection is browser `(337.3375,360.4433333333333)`. This run's operator parses floating coordinates, and the driver accepts finite coordinates within its existing viewport bounds. An actual-driver VM test verifies the exact fractional values and rejects NaN, infinity and out-of-bounds points. This path was tested offline and **not exercised against the guest**.

Navigation steps now validate the original strict per-guest ACK predicate, rather than checking only aggregate `ran` and `timedOut`. Each command remains bounded to 64, with an additional navigation ceiling of 16384; native Start and ordinary gesture budgets remain 4096 each. The same actual-driver fixture rejects an incomplete guest ACK, invalid command sizes and aggregate exhaustion. State captures additionally record the actual native presentation geometry without changing guest state.

Before browser launch, the original native model suite, immutable snapshot suite, integrated queue/review fixtures and navigation regressions passed locally. The corrected actual driver passed integration, snapshot/close ordering, balanced cleanup, fractional coordinates and ACK/cap fixtures remotely. Actual CommonJS and dynamic Puppeteer **25.7.0** imports passed, and five real loopback HTTP responses matched their pins and COOP/COEP headers. An initial remote test invocation used an incorrect absolute helper path; its failure is retained in `remote-commands.jsonl`. The staging path was corrected and all remote checks passed before launch. The mistakenly uploaded small helper directory was removed after closure.

## Observed stopping boundary

I personally viewed `review/startup2048.png` before further startup execution, then `review/loaded6144.png` before considering navigation. The latter remained loading artwork. Only read-only state, immutable snapshot and normal quit followed it. There was no second browser, reload, substitute gesture or additional execution after that capture.

The actual geometry matches the supported 800×600 native canvas, browser rectangle `(10,194,860,668)`, nearest presentation and DPR 1. The queue is empty, but `activeInput`, `lastInput` and `mouseButtonsMask` are **absent** from the serialized startup state, rather than explicit null/null/zero. The unchanged strict native readiness guard rejects this fresh state with `input not drained`; the scene recognizer returns `unknown`. `startup-guard-regression.json` records those actual checks. No ready/drained/world claim is inferred from filenames, an empty queue or the geometry. The initial evidence verifier assumed those fields existed; it was corrected to assert their absence and report `strictReady:false`, without changing the runtime guard.

## Recovery and handoff

`verify.py` passes full SHA-256/length verification of immutable **final-live 212** and **closed 217** logical files, reusing matching bytes. It verifies **101 sequential successful replies**, **96 exact per-guest step ACKs**, total **6144**, maximum **64**, all **803 served-file pins**, capture hashes and absence of input or execution after the deciding capture. Browser PID **15911** ran **05:50:11.770–05:51:40.720Z**, **88.95 seconds**, exit zero. Recovery completed before 06:11Z and closure before 06:06Z.

Actual exec **05:52:14.921171Z** confirms Chrome and driver absent, private HTTP port **44047** closed, and all **2415 runtime pins unchanged**. Assigned **bx_c5e39n22** remains RUNNING/API-idle, healthy and hydrated, expiry **2026-11-04T06:21:54.275Z**. Shutdown ownership returns to the coordinator. No lifecycle action was performed.

The retained minimal runtime, installed media and both previously recovered modules were reused intact. `source-reference.json` names exact Git/source-patch/media/module references and verifies the retained module hashes; no source archive, repeated binary or media copy was made. `owned-new-helpers.patch` reconstructs small run helpers not committed alongside this note. Logs, captures, manifests and JSON stay in the ignored run directory. No production changes or full build were needed.

Next work requires separate authorization to investigate the startup divergence using the preserved evidence. The corrected Crusader route and guarded scenario Start remain unexecuted by this task. This worker stops after this task.
