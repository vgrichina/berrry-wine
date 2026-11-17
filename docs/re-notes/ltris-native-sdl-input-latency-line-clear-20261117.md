# LTris SDL latency diagnosis, 2026-11-17

The historical Player1 timeout remains unexplained. No latency repair or
original line clear is claimed. This task launched **zero original processes**:
the fresh original attempt requires a demonstrated repair, which was not
established. The old terminal UNKNOWN endpoint was never contacted.

Evidence: `scratch/runs/20261117-ltris-native-sdl-input-latency-line-clear/result.json`.
The prior original's 507.729 ms transport timeout and 73.460 ms independent UP
remain unchanged. That run retained neither request phase timings nor a DOWN
consumption receipt. Its evidence cannot distinguish slow transport startup,
native delivery, event-loop delay or observation publication. It did not enable
ProcessDesktop observation, so HL2's separately repaired recurring diagnostic
write cannot be assigned as this original's cause.

## Added diagnostic coverage

`lib/control-server.js` optionally records bounded HTTP phases with
`WINE_CONTROL_PHASE_TRACE`: request, body parsing, command entry/return, promise
resolution, JSON serialization, response end/finish and disconnection. It keeps
at most 2048 rows in memory and writes only at process exit. A real delayed
loopback request test proves that observation neither answers an unresolved
command nor writes during the operation, and proves the row bound.

`LTRIS_CONTROL_PHASES=1` adds bounded controller observations and shared-memory
transport-child timestamps around urllib opener construction, header/body
receipt, actual child wait and observer publication. No diagnostic file is
written by the transport child. Existing absolute 500 ms bounds and receipt
timestamps are unchanged. The runtime can explicitly hash-pin the owned HTTP
provider during development; absent that opt-in it uses exact Git providers.
All adopted hunks and rejected foreign WIP are retained as patches.

## Native fixture and measurements

`test/test-ltris-sdl-latency.cjs` generates an authored PE using the authentic
SDL DLL, SHA-256 `d6c4166c6a00525b68ef1e8e5422963c88907589e150c85693518a93722d5d61`,
which is byte-identical in LTris and LMarbles. The program calls real SDL_Init,
SetVideoMode, PollEvent, GetMouseState, FillRect, Flip, Delay and Quit through
ordinary imports. Its two coordinate clicks match the original Controls and
Player1 positions. SDL motion must arm each button before its native button
event advances the visible authored surface. Continuous redraws and real SDL
WinDIB pumping run through the full current CLI, guarded native USER return,
independent physical release and native Escape/SDL_Quit/ExitProcess(0).
`test/test-ltris-parallel-guards.py --sdl-route` runs and checks this route.

The final measured route (`fixture-transport-phases`) retained:

| Gesture | Complete HTTP | Prepare to native return | Opener construction | JSON serialization | Observer publication |
| --- | ---: | ---: | ---: | ---: | ---: |
| Controls | 102.107 ms | 44.088 ms | 34.543 ms | 0.024 ms | 0.733 ms |
| Player1 | 96.331 ms | 35.948 ms | 38.541 ms | 0.016 ms | 0.614 ms |
| Escape | 160.899 ms | 24.145 ms | 45.821 ms | 0.061 ms | 2.418 ms |

The selected full screenshots show blue menu, green Controls and red Player1
**fixture surfaces**, not LTris gameplay. All three distinct public pixels and
native consumption identities are checked. This exercises the real consumer
and control route, but does not reproduce every original menu blit or its
historical scheduling/I/O workload. Neither these passes nor the opener cost
establishes the cause of the 507.729 ms failure. No speculative transport,
renderer, pump, deadline or receipt-predicate change was made.

The original module `533c599a144837890b6b45f6cbace2e52e9b4f48a3a8dd08b4261cd20223b1a1`
was reused by existing path, with its prior exact compiled Git/patch/input
proofs. Sealed pre-execution module hashes and real Worker receipts are retained
for each fixture. The 43 prior execution-media records remain hash-identical;
there is no module or media copy, source archive, frame archive, game-state
inspection, solver, autoplay or configuration/clock edit.

## Boundary and next work

Policy tests, native wrong-owner/late-ACK/UNKNOWN/parent-stall guards,
independent release with zero later requests after terminal closure, the SDL
consumer regression and delayed/progressing HTTP transport tests pass. Actual
native, watchdog, supervisor and outer child waits and both EOFs are retained.
Early authored setup failures remain failures: aliased import tables, a capture
name collision and their host cleanup are not native Quit proof. No endpoint
was retried after terminal closure. The result records the canonical locked
build and publication status separately.

Next requires a workload-faithful reproduction of the original timeout, with
these phases enabled, before selecting a repair. The conditional original
allowance remains unused. No box was created: ID null, state NOT_CREATED,
expiry null, stop receipt NOT_APPLICABLE. All owned runtimes are stopped.
