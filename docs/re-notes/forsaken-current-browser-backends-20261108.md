# Forsaken current browser backends, 8 November 2026

The fresh WebGL arm stopped at a concrete startup-control blocker before its
first original-game key dispatch. It supplies no new world/gameplay qualification.
The software Direct3D arm was not launched after the first terminal UNKNOWN.
Existing f965 native/software CLI movement/fire and older e415 browser WebGL
death/respawn evidence remain accepted; this run does not replace them.

Evidence: `scratch/runs/20261108-forsaken-current-browser-backends/`.
No production source changed.

## Causal boundary

`retrieved/original/startup.png` was personally inspected: the original demo
features/logo screen is readable. Its capture and before/after binding records
agree on the registered `forsaken_demo`, main CPU endpoint 1, and **no render
endpoint yet**. The current instantiated CPU module was recovered through CDP:
2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.

The first requested Enter (100 ms, 8-second settle) reached the exact numbered
consumer. During admission, the live renderer endpoint was now **1**. The
capture-bound identity guard rejected `1 !== 'none'` at `bound-input.cjs:141`,
before invoking the input dispatch callback. The runtime closed at
01:25:58.931Z; the ACK client observed `runtime first fault`, recorded a sticky
terminal UNKNOWN and did not receive a success ACK. The command ID was consumed
once and was never replayed. There are no original input-admission or hold
receipts. Generated prelaunch trusted-event tests are separate from game input.

This is a harness lifecycle problem: a reviewed pre-render logo capture was
used after a render owner appeared. It is not a demonstrated WAT/JS renderer
disagreement, persistent black screen, guest crash or input handling failure.
The evidence does not qualify the newly appearing endpoint's legacy context,
fallback counts or render module; the startup screenshot and toolbar cannot
provide that ownership proof. No software-backend ownership claim is made.

The run-local `endpoint-transition-test.cjs` reproduces this exact `none -> 1`
identity transition with a generated identity fixture: dispatch count remains
zero, the chain closes, and replay/capture is refused. It exercises the same
unmodified admission implementation used by the original browser.

## Inputs and checks

Source identity is main `b6825ec8def45803ffe672b62ac9fafbef5b11f3`, plus
`relevant-source.patch` and `new-lib_wininit-boot.js.patch`. The runtime pins
record actual staged bytes; Git plus these patches is the source recovery path.
All **873** original fixture paths are unchanged from the accepted browser
closure, including the registered manifest. No media or source archive was
created. The executable remains SHA-256
`366ec5d0943daca839836296f9fb52724e94dc155630c6b0c30d7181106b5e24`;
the manifest remains
`587ce145ab73a3fed2c7136425bb6a7bcf28def312d430c8bf7d1be802b2260b`.

Before allocation, the actual request helper and numbered ACK transport passed
0/1/2/10-second waits, Enter/A/Escape/arrows/Ctrl/Space and A+Ctrl/A+Space holds.
Oversized waits, the stopped-input guard and an insufficient immutable deadline
refused publication. Independent UP passed both a slow-observer test and an
injected UNKNOWN test. A local Chrome preflight verified the exact keys and
combos as trusted events, balanced releases, and zero original launches. The
same preflight passed remotely before original app selection.

The eight existing capture-deadline tests and existing Direct3D fallback-counter
test pass. All **1,481** runtime/helper pins match remotely before and after;
all **254** successful served responses match their pinned bytes. This docs-only
outcome does not claim a new full build, emulator repair or rejecting WAT
regression.

## Evidence and shutdown

All **36 remote references / 34 unique contents** were retrieved and independently
size/SHA-256 verified before normal stop was requested. The browser exited 0;
controller/browser PIDs, HTTP/CDP ports, profile and writer lock are absent.
No original key was admitted or held. The local preflight browser also exited 0.

Fresh box **bx_phykqaqa** is **archived**, current expiry null, original expiry
**2026-11-08T01:49:41.959Z**. Normal stop **stop_bda3271281cf265e** completed
**01:26:42.117Z**, `forced:false`, error null. Its detached 25-minute watchdog
was observably armed before allocation; both lifecycle delegates exited zero
and the supervisor has no children. Sampled local/remote free disk exceeded
5 GB. No stopped box was resumed/deleted and no public deployment occurred.

Next: make startup capture readiness require the owning legacy endpoint, or
handle the pre-render-to-render transition through a new reviewed capture
before publishing any input. Qualify that lifecycle case before a separately
assigned fresh original run, then complete WebGL followed by software Direct3D
world/thrust/look/fire/corridor evidence. Outgoing damage/kill, full 27, parity,
FPS and audio quality remain open.
