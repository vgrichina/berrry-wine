# MDK2 native-tracked original startup

Code publication: `4d52aa22146de8354f8412945ae1de0726936b4e` on shared main. Evidence: `scratch/runs/20261105-mdk2-native-tracked-original/`. The native pending-context v1 implementation published through `036088ef12eb90aed902efa67545b758d5c70ecc` is retained. Work followed Stronghold natural-setup-cause FINAL `a3dfef099b66941f488f2420d1042a2dd0b9812c`, then D3DIM immediate-drawing FINAL `03b16e2553ddbe7d879fea8524e9df479a97fa07`, with independent normal-cleanup and free-lock checks before shared edits and runtime.

## First-failure enforcement

The authenticated instantiate wrapper still arms the owning instance before exposing it. It now seals the first failed arm, invalid native context before/after an ordinary run, or rejected synchronous live admission. It preserves the first failure and startup journal, throws to the existing failure closure, and forwards no later native run after that failure. Callback, nonlocal and foreign-lifetime invalidation remains sticky. No native code or guest scheduling/input behavior changed.

The seam remains actual `PC=47d9c8`; caller positions `6/14/22/39/42/45/47 = 47ca7e/47a928/47b393/47c012/47c626/451546/402176`; valid current owner/thread/epoch and depth0. The same continuous observer must see genuine GC `443070` entry and `40218c` return with entryESP+4. Limits remain 50M boundaries, 360s and 512 records. No prior CALL/GC history is supplied.

## Validation and binding

- Both-module native contract and live-admission checks: 90/90 pass, including immutable failure and no subsequent guest execution.
- Integration: 189 unchanged cases pass in `integration-first.log`; two synthetic direct-entry cases initially failed their former acceptance expectations. Revised cases pass in `integration-missing-call-fixed.log`, requiring missing-CALL reason5 at the first native boundary and matching all captured GPR/lazy flags, halt, block count, yield and command prefix against the untracked control. The first comparison-only failure is retained in `integration-missing-call.log`.
- Local runtime: 43 current applicable checks pass in `local-current-scope.log`. Observer full-memory/GPR/lazy-flags/commands/trap parity passes for both modules in `observer-current.log`. Historical resolver scope: 17/17 pass in `resolver-historical-scope.log`.
- Five fresh-binding checks pass in `named-binding.log`: finite deadlines, exact current-run identity, complete prior/historical inventories, exact named amendments, and in-memory corruption/wrong-pair/source negatives.
- Required `flock /tmp/wine-build.lock bash tools/build.sh` passes in `required-build.log`, reproducing the exact tested module pair. No additional build is needed for documentation.

Initial stale-binding failures are retained in `local-focused.log` and `resolver-historical.log`. These use former current-module identities or amendment counts. Historical manifests were not rewritten to make them pass; the exact fresh named binding and actual composed entry cover the current dependency instead.

The run-local binding changes only finite host deadlines (close ceiling12:50Z, recover ceiling12:53Z, normal release720s plus180s recovery), assignment/composition identity, three exact published D3DIM source amendments and the two existing rebuilt module references. Full prior manifests and all historical rows remain embedded. Binding recipes and input hashes are retained in the run directory. The dependency gate retains D3DIM's actual `FINAL RELEASE ... LOCALHEAVY runtime ALLBUILDSFINISHED` wording and independently verifies that runtime and files were both released.

| Existing module path | Bytes | SHA-256 |
| --- | ---: | --- |
| `build/wine-assembly.wasm` |2157012| `34951f71b69b36c353eef5afa40eb398f291da25c4a8b678e8e9b26eb1435103` |
| `build/wine-assembly.compat.wasm` |2159627| `38574c63b04f83ef9e0467967cacab43021efe78b88ea85f338bbf32d4da2630` |

Actual composed filesystem/HTTP preflight passes before the original: 439 filesystem rows, 439 proof HTTP bodies, 439 actual caller HTTP bodies, one mocked launch boundary, zero Chrome launches, public/native spawning forbidden with zero calls, two server closures and refused ports. `preflight-result.json` and `preflight/` retain the result and mock history separately.

## Original result

Exactly one original launched at 06:45:32Z. The owning Worker was paused before its first script and received the authenticated preload; its recorded canonical module is `build/wine-assembly.wasm` from the pair above. I personally viewed `browser/startup-0.png` before authorizing startup: teal application background and runtime log, frozen step0, Lua not initialized, no rendered game menu or gameplay. `personal-view-startup-0.json` records that review.

The only progression command was command1, an ordinary frozen step request64. It ran one guest slice, then the Worker stopped. The console records `native pending context incomplete: 5 @ EIP=0x7500218 prev_eip=0x481fbf esp=0x74ffd14 eax=0x0 ebx=0x610c0c ecx=0x1 edx=0x610c0c esi=0x6c edi=0x5f2700 ebp=0x74ffd44`. The controller retained the first failure as an incomplete frozen step (`requested64`, `ran1`, guest runningfalse); no subsequent command or second original was issued. Reason5 means unsupported callback/unwind/coverage. A CreateThread console event immediately precedes the trap, but the exact invalidating path is not established by this evidence.

The existing Worker trap path terminated the Worker before terminal CDP retrieval. `bounded-trace-lost.json` explicitly records `TargetCloseError` and historyunknown; `final-state.json` likewise records the lost target. No native startup journal, exact failure boundary/epoch/depth, successful seam admission, genuine observed GC entry/return or gameplay is claimed. `immutable-first-failure.json`, `terminal-journal.json` and their SHA-256 seal retain the available failure, commands, final state and explicit unknowns. The missing native journal is a concrete evidence limitation, not reconstructed history. A future separately authorized investigation needs to identify the reason5 path and preserve native fault telemetry before Worker termination.

The first-failure closure called normal `Browser.close`; Chrome PID2364151/startTicks190835022 exited0/no signal, and the entry process exited0/no signal. Independent `cleanup-verification.json` checks the Chrome, entry and parent PID/startTicks are absent, all three actual server/DevTools ports refuse connections, no profile users or heavy processes remain, the owned profile is absent and both runtime/build locks are free. Chrome and the entry received no signals; invalidity was not reset or bypassed, and no original was retried. The owned board watcher alone received SIGTERM after checking its exact PID/startTicks, command and output identity; its absence is recorded in `watcher-cleanup.json`. No box was assigned.

Recovery uses exact Git SHA plus relevant binary diff/new-file patches, existing input/media/module paths and SHA-256. No source snapshots, archives, media/module copies, boxes, subworkers or deployment are used. Box ID/state/expiry: NA; coordinator retains shutdown ownership.
