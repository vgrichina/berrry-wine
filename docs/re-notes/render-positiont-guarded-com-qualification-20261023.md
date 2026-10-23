# POSITIONT guarded diagnostic COM task: reviewed checkpoint

**Checkpoint update:** boundary acceptance is now available from separately
assigned worker commit `004eb539fd58168ce935f829e3fb5cd26f350df6`. All 24 seals,
unchanged guard/control bytes, causal assertions, exit 0 and full reaping were
independently verified. Together with this worker's source review and small
control, the guard is accepted for the audited synchronous POSITIONT call sites.
See [boundary acceptance](render-positiont-guarded-com-qualification-20261023/boundary-acceptance.json).
The earlier blocker below and `verdict.json` retain their pre-boundary sample
scope; they are superseded by this acceptance. One exact diagnostic build and
four qualifiers remain conditional on fresh admission. No build has yet run at
this checkpoint. This review/recipe is preserved before the heavy phase.

**No diagnostic build or COM qualification ran.** Shared guard commit
`9f442e41bb81853659d8664e1aa903e560d4061e` explicitly leaves its required
boundary acceptance controls unexecuted and declares the guard not fully qualified
for reuse. Independent source review passed for the audited synchronous constructor
sites, and the single small independent under-bound/mutation command passed, but
these do not substitute for that outstanding shared acceptance. This worker did
not implement, correct or weaken a guard, or run a larger native compilation to
complete another worker's task. First blocker:
`SHARED_GUARD_BOUNDARY_ACCEPTANCE_UNAVAILABLE`.

The old static exact-output-size blocker is superseded by the user's constructor
guard authorization. Unknown emitted size alone did **not** block this task.
Once accepted, the guard's 8,388,608-byte synchronous ceiling would also satisfy
the 25,165,824-byte regular-file ceiling before the builder's validation/write.
The fixture's later 32 MiB assertion is not admission evidence. No ineffective
Node wasm-max-module-size flag was used.

## Independent guard review and actual small control

Reviewed [shared guard](/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs)
SHA256 `47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197`,
2,462 bytes. Its published seals were checked against retained files and exact
commit contents. Strict actual remote lookup matched that commit and main
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`.

Intrinsic ArrayBuffer/SharedArrayBuffer/TypedArray/DataView getters perform brand
and length checks without trusting overridden properties. Fixed views use their
view length; exact original bytes, offsets, argument array, options and newTarget
reach Reflect.construct only after the limit check. Unknown/proxy/spoofed forms
and resizable/growable backing stores fail closed. The Proxy forwards native
prototype/static behavior and admitted native errors. Producer's six sealed small
control groups cover malformed errors, DataView native rejection, cross-realm and
Buffer input, argument identity, subclassing and unknown forms; those were reused.
This is a restriction on audited call sites, not a hostile-code sandbox: other
native entry points are outside its claim. The compiler's VM stages emit bytes;
the diagnostic builder's native constructor call is in the preloaded Node realm.

The independent [control](../../tools/positiont-guarded-independent-control.cjs)
ran once after the combined preflight:

```sh
/usr/bin/prlimit --cpu=30 --fsize=25165824 -- \
  /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=128 \
  tools/positiont-guarded-independent-control.cjs \
  /home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs
```

Actual argv uses the absolute control path; see [receipt](render-positiont-guarded-com-qualification-20261023/independent-control.json).
**Exit 0**, 0.018 seconds, 257 captured bytes, measured child peak RSS
49,238,016 bytes. One authentic eight-byte native Module from a view at offset 7
passed; no Memory or Instance existed. A tiny resizable backing with lying own
byteLength/resizable properties was rejected before a JS constructor sentinel.
Removing the guard caused that same oracle to fail, proving mutation sensitivity
without an oversized native validation. The maxByteLength reservation was
8 MiB+1; only eight bytes were current backing length. No boundary-size native
compile occurred. TERM + five-second KILL, aggregate 512 KiB capture overflow 125,
24 MiB files and Linux subreaper/group reap remained enabled. No overflow/deadline
occurred; these are retained supervisor semantics, not newly exercised escalation
claims. The process group was fully reaped with no adopted residue.

Producer's valid exact-8 MiB admission, valid 8 MiB+1 rejection-before-native and
its own guard-removal acceptance controls remain **UNEXECUTED**. Its report requires
these before reuse. A fresh independent planning sample found MemAvailable
**4,247,654,400 bytes**; producer's old memory denial is not asserted to remain
current. Its original launcher PID 1779214 was absent and no shared-task Node
process remained. This worker did not run a heavy-phase attempt or capacity retry.

## Exact closure and combined admission

Fixture `7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6`, donor
`/home/user/wine-assembly-render-positiont-com-qualification-fixture-oct23`;
user-supplied scoped offline acceptance
`aea185d3dfc1b772cea00ca1a4aed14b9553dfed`. Successful readiness
`54d701e9d7f5de8c9e8fc045864228e6d85db01f` and prior blocked diagnostic
`6fb1ce4b36b5463b100557a8299ad5d4a9cd2f51` were read-only inputs. All 26 readiness
and 15 prior-diagnostic seals were verified against files and exact commits.
The accepted 52 invocation prefix, decoder and 27 controls were reused without
replay. No assumption of historical objects in thin stores or speculative source
lookup/fetch was made.

[Manifest](render-positiont-guarded-com-qualification-20261023/source-manifest.json)
contains **290 retained exact files / 27,366,397 bytes**, including all **286 pins**,
verified to blob, size and SHA256 through the accepted manifest. Compiler closure
has nine files including four dynamically VM-loaded stages, plus source pins;
qualification has 47 conservative JS/JSON files. All entry includes are present.
No source was staged. [Closure](render-positiont-guarded-com-qualification-20261023/closure.json)
records literal edges, dynamic stages and external dependencies.

Qualification's explicit prebuilt branch never calls its default compiler. With
fonts:none, no font data mounts/read occurs. The software Bridge has no worker
factory, shared worker option or GL selection: optional headless-gl addons are
deferred inside load(), Worker constructors are inactive, event-authority methods
are uncalled, and resources-icon fetch/loadImage branches are uncalled. Dynamic
WINE_REGION_MAP must be unset. Standing pngjs 7.0.0's 27 files and seven installed
executable identities were independently reverified. Standing donor/tool footprints
are separately accounted in [standing.json](render-positiont-guarded-com-qualification-20261023/standing.json);
inherited donor footprint samples retain their original time. No tool install,
copy, archive, hidden link, donor metadata mutation or broad fetch occurred.

The first read-only planner assertion conservatively discovered optional GPU and
Node worker builtins; source review classified their inactive routes before the
combined executable preflight. This was planning, not a source lookup failure or
compiler attempt. [Preflight](../../tools/positiont-guarded-preflight.py) ran once,
exit 0, admitted the review phase only, and has a receipt latch.
[Combined receipt](render-positiont-guarded-com-qualification-20261023/combined-preflight.json)
projects **56,188,369 / 67,108,864 bytes** including measured private Git/planning,
all exact source copies retained through the final pin consumer, 8 MiB module,
64 KiB provenance, finite temps/directory overhead, six aggregate command captures,
Git/report/evidence growth, external launcher **and** separate Codex session JSONL
growth, and 8 MiB reserve. Compiler disk temps are absent in the audited source;
compile buffers remain in heap. Host free after projected incremental growth
exceeded 2,982,150,144 bytes. The one-shot receipt contains exact values.

This is a complete planned source/data/resource closure, **not build admission**
or a claim that every command ran. Compiler admission remains old-space <=2048 MiB,
CPU/wall <=900s, MemAvailable >=2,684,354,560; qualification old-space <=512 MiB,
CPU/wall <=150s, MemAvailable >=1,610,612,736, one shared 512 MiB/8192-page arena
and Instance at a time. Old-space limits do not bound RSS. No full source copies,
module, provenance, arena, Instance, COM allocator or software-pixel run exists.

## Recovery commands — all unexecuted

Future coordinator-assigned continuation first needs shared boundary acceptance
and fresh full resource/process admission. Keep this exact diagnostic builder,
its intentional appended extraWat exports and tailCalls=true; no normal module
rebuild, source fix, pin refresh or default compile is authorized here.

```sh
NODE_PATH=/home/user/wine-dashboard-deps-20261014/node_modules \
node --max-old-space-size=2048 --require "$REVIEWED_GUARD" \
  test/support/positiont-com-module.js --build-diagnostic \
  build/positiont-com-diagnostic.wasm build/positiont-com-diagnostic.provenance.json
```

After successful build, verify module/provenance SHA256, provenance fields,
diagnostic exports and all 286 pins. Run these four fresh processes sequentially
under the retained limits, stopping at the first unexpected result:

```sh
node --max-old-space-size=512 --require "$REVIEWED_GUARD" \
  test/test-d3d9-positiont-com-qualification.js --qualify --allow-512m \
  --module=build/positiont-com-diagnostic.wasm \
  --provenance=build/positiont-com-diagnostic.provenance.json
# Same command plus each, separately:
# --negative-control=disable-shared-route
# --negative-control=alias-queued-bytes
# --negative-control=corrupt-queued-ir
```

NODE_PATH remains the standing path; unset inherited NODE_OPTIONS and WINE_REGION_*
overrides as recorded in preflight. Expected exits are baseline 0, negatives 1
with matching ARMED and intended oracle failure. Actual baseline and all three
negative outcomes are **UNEXECUTED**; module/provenance SHA256 are **null**. There
is no ignored binary to back up. Git stores the review/manifest/recipe/evidence,
not an inferred binary backup. Any future successful result must say
**GUARDED_DIAGNOSTIC**, actual local software pixels, never uninstrumented
canonical/browser/WebGL/game acceptance.

No box assigned/contacted: ID/state/expiry N/A, lifecycle owner coordinator.
No workers/refill, Boat/browser/GPU/game, guest/persistence/Play, shared refs/main,
merge or deployment operation. ShadowMan/RichEdit/Claude/laptop ownership remains
untouched. This bounded task stops on the shared acceptance blocker after strict
branch publication; the coordinator owns the next assignment.
