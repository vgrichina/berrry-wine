# Complete-module MIDI qualification (2026-10-30)

PASS on base `dc22b2b38624da40b2dcec29c76bfb986ae03a35`.
No production source changed. All 143 source/compiler/helper pins were checked
locally and after API transfer. The recursive canonical WAT closure has 128
inputs. `compileClosure(watxSourceClosure(), {tailCalls: true})` used its
production, standardWat, strictDeclarations, runtimeBuiltins:false contract.

The resulting complete module is 1,881,185 bytes, SHA256
`3aa9db179499ba1d56e523620c40ac77ee57b5f5c75f89b2ae7d50691557d4ee`.
It compiled and instantiated on Node 24.22.1 / V8 13.6.233.17-node.58.
Compilation measured 323,727,360 bytes peak RSS under the 4096 MiB group ceiling.

`lifecycle.js` uses the unchanged production `createAudioHost` and every original
MIDI Wasm import. A declared synthetic PE is initialized by production `load_pe`;
its named imports are resolved by the real lookup table. Exported `run` enters
the original thunk dispatch, generated API table and production MIDI handlers.
Every call checks the registered ID, API counter, return value and stdcall ESP.
There is no extracted WAT, fake MIDI handler, or historical source overlay.

The executed lifecycle opens a stream, prepares and queues its owned header,
starts, stops, checks PREPARED/DONE/INQUEUE flags and drains MOM_DONE exactly once.
The production host pumps MOM_OPEN, MOM_DONE and MOM_CLOSE into the original
callback export. A tiny synthetic x86 RET 20 and the real CACA000A continuation
restore EIP, ESP and EAX. Subsequent service and restart leave the queue empty and
do not replay the abandoned note. The final close callback also demonstrates
that no duplicate callback remained in flight. Dropping exactly one accepted
MOM_DONE at the host queue boundary makes the delivery assertion reject; source
and module bytes stay unchanged.

Two retained fixture incidents precede the passing group: a fail-closed diagnostic
adapter encountered `log_api_exit` (fixed using production `set_api_log(0)`), and
the callback's first one-block slice stopped at its return continuation (fixed by
asserting that exact CACA000A thunk and taking the next bounded slice). Neither
required production changes, weaker assertions, or another compilation.

This qualifies the complete-module dispatch/audio-host boundary with synthetic
guest state. Mad Bomber's actual binary/gameplay, a native application, a browser
and hardware audio remain OPEN. The tiny synthetic callback is the only x86 code
executed; direct Wasm calls do not establish complete guest execution.

The complete import/export inventory (291 / 2225 entries), compiled module,
source pins, original archive, supervisors, logs and both incidents are retained
at `/home/user/madbomber-midi` in the completed snapshot of Boat `bx_3ckx3mvs`.
`artifact-manifest.json` binds their exact bytes. The worker snapshot-stopped the
box at 02:30:38Z; no automatic resume is authorized by this report.

The full inherited index gate streamed 14,956 entries / 13,476 unique objects and
found zero missing objects. It did not inspect unrelated ancestor history.
See `index-closure-report.json` and `recovery-recipe.md`.
