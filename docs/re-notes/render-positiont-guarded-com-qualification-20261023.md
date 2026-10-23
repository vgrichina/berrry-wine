# POSITIONT guarded diagnostic build passed; COM baseline failed

**GUARDED_DIAGNOSTIC build exit 0; baseline exit 1.** The first unexpected failure
was `finite-RHW1e-39-honest-fallback: complete BGRA/depth oracle`, at fixture line
180. Execution stopped immediately; all three negative controls remain
**UNEXECUTED**. No repair, retry, source fix, pin refresh or normal module build
occurred. This is a real local native COM/software-pixel baseline failure, not a
resource-admission or build failure. Full COM qualification is **not accepted**.

The baseline had already passed nine shared-route/native software-pixel cases:
DP, INDEX16/INDEX32 DIP with positive and negative base, multi-stream stride/
offset, DPUP, and three depth comparisons. Their exact frame hashes and counters
are in [baseline.log](render-positiont-guarded-com-qualification-20261023/baseline.log).
The finite tiny-RHW fallback case then differed from its complete expected
BGRA frame. No root cause is asserted and no corrective investigation was run.
Allocator-reuse/queue/final-release checks later in the fixture were not reached.

## Accepted guard review

Reviewed guard commit `9f442e41bb81853659d8664e1aa903e560d4061e`,
SHA256 **`47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197`**,
2,462 bytes, at
`/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs`.
Its published seals and exact committed bytes were checked; strict remote lookup
matched its branch. No duplicate implementation, guard correction or weakening.

Intrinsic brand/length getters ignore shadowed user properties; fixed views use
their precise view length. Unknown/proxy/spoofed and resizable/growable forms
fail closed. The guard checks <=8,388,608 bytes **before** Reflect.construct;
original source/view/offset/options/argument array/newTarget reach native code.
The Proxy forwards static/prototype/call behavior and admitted native errors.
Producer's six sealed small control groups were reused, including native DataView
rejection, cross-realm input, subclassing, errors and argument identity.
This guards the audited synchronous call sites; it is not a hostile-code sandbox
against retrieval of other native entry points. Compiler VM stages emit bytes;
the builder's constructor runs in the preloaded Node realm.

The independent tiny [control](../../tools/positiont-guarded-independent-control.cjs)
ran once after combined preflight: **exit 0**, 0.018s, 257 captured bytes, measured
child peak RSS 49,238,016 bytes. One valid eight-byte Module in an offset-7 view
passed. A tiny resizable backing with lying own byteLength/resizable properties
was rejected before a JS sentinel; removing the guard made that same oracle fail.
No oversized native validation, Memory or Instance occurred in this control.

The original producer stopped before boundary controls, so this lane held its
review open for the coordinator's separately assigned control worker. Published
commit `004eb539fd58168ce935f829e3fb5cd26f350df6` supplied the missing evidence.
All **24 seals**, unchanged guard/control bytes, actual strict remote SHA, causal
assertions and full reap were independently verified. Exact 8 MiB entered native
construction once; 8 MiB+1 rejected before native spy entry; guard removal reached
only Sentinel and was caught by the same oracle. No boundary compilation was
repeated here. [Acceptance receipt](render-positiont-guarded-com-qualification-20261023/boundary-acceptance.json)
records this review. The guard is **accepted for this audited diagnostic lane**.
The earlier [checkpoint](render-positiont-guarded-com-qualification-20261023/pre-boundary-checkpoint.json)
retains its historical blocked scope and is superseded by that acceptance.

## Exact build, provenance and execution

Fixture is **`7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6`**, scoped offline acceptance
`aea185d3dfc1b772cea00ca1a4aed14b9553dfed`. The successful readiness commit
`54d701e9d7f5de8c9e8fc045864228e6d85db01f` and prior blocked diagnostic
`6fb1ce4b36b5463b100557a8299ad5d4a9cd2f51` were read-only donors. All 26 readiness
and 15 prior-diagnostic seals were reverified against files and exact commits.
Accepted 52-prefix/decoder/27-control evidence was reused, never replayed.

The exact pinned builder intentionally appends diagnostic extraWat exports only
to 13-exports.wat and passes tailCalls=true to the production/standardWat,
no-runtime-builtins/strict-declarations compiler closure. It is not the normal
production artifact. The user's corrected 8 MiB constructor restriction supplies
pre-native/write size admission; unknown precompile emitted size and the fixture's
postcompile 32 MiB assertion were not blockers or substitutes for that guard.
No ineffective wasm-max-module-size flag was used.

Actual exact build argv, inside cwd
`/home/user/wine-assembly-render-positiont-guarded-com-qualification-oct23`:

```sh
/usr/bin/prlimit --cpu=900 --fsize=25165824 -- \
  /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=2048 \
  --require /home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs \
  test/support/positiont-com-module.js --build-diagnostic \
  build/positiont-com-diagnostic.wasm build/positiont-com-diagnostic.provenance.json
```

**Exit 0**, 2.946s, zero capture bytes. Guard preload is solely the authorized
constructor size restriction. Result:

| Retained artifact | Bytes | SHA256 |
| --- | ---: | --- |
| build/positiont-com-diagnostic.wasm | 1,883,322 | `93f41b0fdce5494a235c789bd92f5dcf6cddb7ee16d721d0654a9f9958e7f0bb` |
| build/positiont-com-diagnostic.provenance.json | 1,002 | `190a3d56230da32fcba586230ec08e6a6d96c552cc475eece9750a8e84373383` |

The separate hash/provenance/all-286-pins-only command
`node --max-old-space-size=128 tools/positiont-guarded-verify.cjs` exited **0**
before native qualification; it creates no Module/Memory/Instance. Diagnostic
extraWat SHA256 is `4bd65ac87452abb4ec5f728f88b399439c9fa4fec91a53b3e6cb96468f58d068`.
The pinned helper's embedded candidate/acceptance labels are retained unchanged
in [actual provenance](render-positiont-guarded-com-qualification-20261023/diagnostic.provenance.json);
the exact fixture revision and source pins identify this task's tested inputs.

Baseline actual argv:

```sh
/usr/bin/prlimit --cpu=150 --fsize=25165824 -- \
  /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=512 \
  --require /home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs \
  test/test-d3d9-positiont-com-qualification.js --qualify --allow-512m \
  --module=build/positiont-com-diagnostic.wasm \
  --provenance=build/positiont-com-diagnostic.provenance.json
```

**Exit 1**, 0.125s, 3,063 captured bytes, complete unexpected assertion retained.
This used the fixture's explicit no-default-compile route, one shared
512 MiB/8192-page arena and one Instance in one fresh process. The process/group
was fully reaped, releasing the arena before task completion. No task-owned Node
process remained. The three same-argument commands with
`--negative-control=disable-shared-route`, `--negative-control=alias-queued-bytes`
and `--negative-control=corrupt-queued-ir` were **not run**. No matching ARMED or
intended exit-1 negative outcomes are claimed.

NODE_PATH stood at `/home/user/wine-dashboard-deps-20261014/node_modules`.
Inherited NODE_OPTIONS, compile-cache/coverage/debug outputs and WINE_REGION_MAP/
SHAKE/compiler/name overrides were removed. Exact argv, limits, captures and exits
are adjacent `build.json`, `verify-provenance-pins.json`, `baseline.json` and logs.
The one-shot [driver](../../tools/positiont-guarded-execute.py) exited **2** on the
baseline failure; its attempt/result receipts prevent unchanged reruns.

## Closure and resource evidence

One combined preflight established **290 exact retained files / 27,366,397 bytes**,
including all **286 source pins**, verified to accepted-manifest blob/size and
SHA256. [Manifest](render-positiont-guarded-com-qualification-20261023/source-manifest.json)
preserves exact read-only recovery locations. No thin historical-object assumption,
speculative source fetch, cold archive, hidden link or donor/index/ref mutation.
Compiler closure includes literal requirements, all main.watx includes and four
dynamic VM stages. Qualification includes 47 conservative JS/JSON consumers.
All source copies remain retained through this stopped fixture's last consumer.

Source review resolves dynamic paths: fonts:none skips font reads, WINE_REGION_MAP
is unset, software Bridge has no Worker factories/options or GL selection,
headless-gl native addons load only in inactive load(), and authority/remote
event, icon fetch and loadImage routes are uncalled. Standing pngjs7's 27 files
and seven installed executable identities were reverified in place and separately
accounted. The first read-only planner assertion discovered these optional imports;
their inactive paths were reviewed before the single combined preflight. No
production/source-availability error or gate retry occurred.

Initial review-phase projection was 56,188,369 bytes. The same phased plan's final
pre-staging admission, including the explicit seventh provenance/pins-only capture
and reviewed driver bytes, was **57,548,825 / 67,108,864 bytes**. This includes
private Git, complete source copies, module/provenance/temps, directory overhead,
all finite captures, evidence/publication, external launcher **and** separate
Codex session JSONL/future growth, plus **8 MiB reserve**. No source release was
assumed. Installed tools/read-only donors are separately identified standing bytes.
Actual observed post-baseline accounting including reserve and future growth was
**44,926,231 bytes**; final publication is separately recorded. Host free after
growth remained above **2,982,150,144** throughout.

Producer's earlier MemAvailable denial was not retried here. After observable
capacity change and full handback/reap, fresh pre-staging MemAvailable was
3,245,707,264 bytes; immediately before compile **3,242,024,960 >= 2,684,354,560**;
before baseline **3,166,842,880 >= 1,610,612,736**. Compiler old-space <=2048 MiB,
wall/CPU <=900s; qualifier <=512 MiB, <=150s. Maximum measured child RSS across
the execution sequence was **359,981,056 bytes**. getrusage is cumulative maximum,
so the repeated baseline receipt value is not an isolated baseline RSS measure;
old-space and planned arena sizes are not total RSS bounds.

Every child retained finite files <=24 MiB, aggregate stdout/stderr <=512 KiB,
fail-closed overflow exit125, TERM then five-second KILL, Linux subreaper and full
reap. No overflow/deadline/escalation was triggered. No overlapping native task
process or native operation was observed. No source/resource guards were removed.

## Recovery, publication and stopping condition

The ignored module and original provenance remain at the exact build paths above;
private `.git/info/exclude` excludes build output. Git is **not** their binary
backup. The module hash/size, original provenance copy, source manifest and consumed
one-shot recipe preserve recovery evidence inside this task allocation. A future
assignment can use the retained bytes after fresh admission; it must not rerun this
consumed build or fixture automatically. Rebuilding is a separate coordinator
decision, with these exact retained source hashes, builder/options, preload,
command/limits and full resource admission. No claim that a future artifact would
retain argv-dependent provenance bytes is made.

Review/recipe checkpoint `66069810d407ae32f4ff256b3fac792044fe6190` was pushed and
actual remote verified before the heavy phase. Final report/evidence publication
uses the same isolated task branch; strict SHA verification and commit are recorded
in append-only messageboard and external publication receipt. Main remains
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`.

No workers/refill, Boat/browser/GPU/game, guest/persistence/Play, shared refs/main,
merge or deployment operation. This is local software-pixel evidence only, with
full COM qualification failed. No box assigned/contacted: ID/state/expiry N/A;
coordinator owns lifecycle. ShadowMan/RichEdit/Claude/laptop ownership remains
untouched. Stop this bounded task at the first unexpected baseline failure.
