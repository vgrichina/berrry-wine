# Stronghold attached original preset attempt, 2026-11-04

This worker owns only the fresh run
`scratch/runs/20261104-stronghold-attached-original-preset/` and the assigned
`bx_9eqxpvx4`. Coordinator owns box shutdown. No other box, worker, Start,
gameplay gesture, production guest-worker edit, deployment or lifecycle command
is authorized here.

The entrypoint is the published
`tools/stronghold-preset-driver-attachment.cjs` from
`f517b6d45eaa1b77bb209451f98f439f1f4be3b6`, with the passive observer from
`8574dfa540da10ade7ba7b5799c974d131775a38`. Its retained original driver and
route hashes remain `230a11947699af0721dc54d58c6b027f6ba21563b59bffc7d2014221ec481a10`
and `bb38b5787c277c94c2913a9ddba72a8663b9fd2fb706a88e320bcb83419633de`.

Preparation verified all 2,415 inherited pins against base
`1188e9bf57ef35bd3363fb88b7ca0da442ce696d`. The initial running box had no
Chrome or game driver. Twenty-four small changed runtime/helper inputs were
staged individually against recorded main
`0b27067a178c12c1591234c7037fa881a5bdb738`. The inherited compiler lacked its
entrypoint and four vendored compiler stage files; those exact small build
inputs were staged individually, then the remote compiler ran under
`flock /tmp/wine-build.lock`. These preparation failures and the initially
stale source entries in the newly authored manifest remain in the raw logs;
the corrected actual `--check` passed before Chrome/game execution.

The old module identities were
`cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`
and compatibility
`580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
`remote-module-identities.json` records the rebuilt exact current artifacts,
which matched local artifacts. Fresh `runtime-pins.json` and
`runtime-release.json` retain the required authorization string, assigned box,
expiry `2026-11-04T16:14:21.621Z`, closeBy `15:59Z` and coordinator lifecycle.

Preflight executed the actual composed declarations without calling main,
verified the 30-file retained helper closure, Puppeteer CJS and ESM, executable
Chrome 151.0.7922.108 and 164 actual HTTP responses with body hashes, isolation
headers and JavaScript/WASM MIME checks. The exact compile/send/slot-0 owning
Worker binding remains a mandatory live attachment gate before activation;
offline preparation is not that live evidence.

The rebuilt normal module is
`4417305d70322467441aef51e888b0fe66451d9c60da0c734eeb23f5a22c0a6b`;
compatibility is
`07fb4e75d05177271097dcd67d84e2629272b50073074bbdea8825ce10b4ed34`.
The sole original run served the normal module with that exact hash; its
144 served-file records all matched the fresh pins. Neither a transferred
Module identity nor its slot-0 instantiation was qualified before failure.
The preflight does not establish the later live paused-Worker transport gate.

## Actual result: bootstrap failure, no preset activation

The one original attachment process launched at `15:42:12.649Z`. Its registered
selector/Launch was recorded, but no readiness record was published. The first
actual failure was at `15:42:55.389Z`, phase `worker preload`:
`TargetCloseError: Protocol error (Runtime.evaluate): Target closed`.
Target `7F4FA222158BE85C078BC90A3EBA4481`, session
`3A71A59A9D049EB0E8175C460D435CFF`, detached at `15:42:55.381Z`.
No successful preload receipt exists. The retained bootstrap subsequently
reported its original 60-second readiness timeout. Cleanup's attempted state
collection reported `Runtime.callFunctionOn: Target crashed`; final state and
the cause of target closure remain unknown.

I submitted initial `observe(2048)` command 0 before `ready.json` existed. That
was premature: it exhausted its own unchanged 40-second reply deadline while
bootstrap was still pending. The mailbox never executed it; no reply, ACK,
observation PNG or guest input was produced. The earlier Worker preload failure
remains the first runtime failure. No title/menu/preset review, game gesture,
trace start, native frame, callback/application history or preset completion
was reached. Absent native/input/ACK/capture correlations are unavailable, not
successful empty histories. There was no reload, repeat or resumed attempt.

I personally inspected the only PNG, `selector-before-launch.png`: it shows
Stronghold Crusader Multiplayer Demo selected in the emulator with frozen
step 0 and its initial blank surface. It is no title/menu/preset/gameplay proof.

## Owned offline dependency repair

`tools/stronghold-attached-original-preset-driver.cjs` composes the published
attachment without editing it or any peer helper. Its bootstrap installs a
`beforeScriptExecution` instrumentation breakpoint while the exact Worker is
still waiting for debugger startup. It releases that startup hold, accepts only
the first instrumentation pause whose parsed script has the exact Worker URL
and an explicit execution-context ID, and evaluates the unchanged preload in
that actual context before resuming the first script. Missing context, wrong
script/reason, lost target or preload exception fails closed without executing
the script. The existing browser deadline bounds the handshake. A failed
preload also requests immediate original browser cleanup rather than waiting
for the later readiness timeout. No guest steps, inputs, recognizers, route,
observer semantics, module identities or original bounds change.

This repairs an explicit bootstrap transport prerequisite; it does **not** prove
why the original target closed or that real Chrome will now succeed. No second
browser/game run was authorized or performed. The concrete next boundary is a
separately allocated browser qualification of this exact first-script/context
handshake and original compile/send/slot-0 binding. Preset activation, settings
application and gameplay remain unproved.

`node test/test-stronghold-attached-original-preset-driver.js` passes exact
transport order and seven negative transport controls, rejects late/expired
attachment, compiles the actual retained helper/driver closure and proves route
and bounds unchanged. These are fake-CDP/VM controls, not browser qualification.
The new test is discovered by the ordinary unit tier. Both the published
attachment's focused controls and the serialized
`flock /tmp/wine-build.lock bash tools/build.sh` pass. The new successor's
actual `--check` passed offline against a separately recorded current local
manifest. The closed run's remote manifest retains its inherited, unused
`tools/callback-ownership-census.json`; this is the only pin difference from
the local successor-check manifest, recorded explicitly rather than rewriting
the run's pins. No runtime inputs or original evidence were changed afterward.

## Recovery and handback

I requested closure of the existing Chrome via its existing CDP endpoint during
bootstrap cleanup; Chrome exited 0 at `15:43:53.798Z`. PID `29934` is absent,
HTTP `45905` and CDP `36085` are closed, and process evidence contains no live
Chrome or game driver. Twenty-two unique raw JSON/JSONL/log/PNG files,
1,832,956 bytes, were recovered with full SHA-256 and size matches. A second
inventory matches all 21 stable artifacts; process sampling is separately
recorded because its command/PID changes. Chrome profile and duplicate closed
snapshot copies were excluded. No source/media/module bundle was recovered.

Custody was returned early at `15:45:10Z`. Last observed assigned box state:
running (`API state=idle`), healthy, hydrated, expiry
`2026-11-04T16:14:21.621Z`. Coordinator owns snapshot/shutdown; this worker issued
no lifecycle command and performed no further box access after handback.

Git commit plus
relevant binary diff is the source archive; no source tree archives, media or
module copies are staged into evidence. Original media stays at its inherited
path with SHA-256
`9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.
