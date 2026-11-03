# Original Jedi: shared CLI desktop and ordinary New Game

Related CLI OS processes now discover real windows through a shared desktop.
In one original launcher Play session, the second original JkDemo.exe child
found the first child's `wKernel` / `Jedi Knight` HWND `0x20001` and took its
own original ExitProcess(-1) branch. Both original WinExec calls remain intact.
The surviving engine accepted profile **Player**, retained **Medium** difficulty,
and reached **Demo - Fuel Station Launch Loading...** through ordinary
Single Player → New Game. Gameplay, movement, look and fire remain unverified.

This continues [the startup-readiness repair](jedi-startup-readiness-20261103.md).
Evidence, recipes, images and full identities are in
`scratch/runs/20261103-jedi-desktop-window-visibility/`. Fresh worker recovery
adopted predecessor3055's scratch preparation after its model-capacity exit;
that predecessor made no production/runtime changes. Exact Alice author release
07:13:36 then GL author release07:30:08.066535 preceded source/build/runtime.

## General repair and verification

`lib/process-desktop.js` provides one private Unix-socket authority and a
synchronous Worker bridge per CLI process. Both existing fork routes propagate
the namespace alongside the existing named-event transport. Each process gets
a distinct, unrecycled process identity and HWND range. Publications describe
actual live WAT USER rows, including native children, owner/parent, class/title,
generation, visibility, style and geometry; no substitute renderer is created.
Creation/mutation publication occurs before startup readiness is announced.

FindWindow/FindWindowEx preserve null-versus-empty and case-insensitive matching,
ANSI/UTF16 inputs, top-level versus child searches and sibling continuation.
Foreign HWND queries resolve the same live directory. Supported scalar posts
reach the owning process's real USER queue, with bounded buffering and generation
checks at delivery; foreign activation reaches the owner's renderer and shared
foreground state. Synchronous cross-OS SendMessage remains explicitly unsupported
with ERROR_NOT_SUPPORTED, rather than claiming delivery. Unknown/dead handles
cannot fall through into the caller's queue. Destroy, guest retirement and
socket disconnect remove identities; retired generations cannot receive delayed
posts. Launcher guest exit retains the authority while its real child hosts live.

`test/test-process-desktop.js` forks actual OS processes with separate memories
and renderers and binds the production imports before WASM instantiation.
Its old-path control fails at the intended exact class/title lookup
(`0 !== 65537`); the repaired path passes actual WAT FindWindowA/W/Ex,
null/empty/case/UTF16, child/after ordering, rename/visibility, text/class/process/
geometry queries, real posted-message delivery and stdcall, unsupported synchronous
send/error50, activation, destruction/recreation, stale posts, guest retirement,
SIGKILL cleanup, independent namespaces and launcher retirement with live children.

Eleven focused existing regressions pass: find-window, IsWindow validity,
active-window, synchronous window ownership, process-send broker/admission/runtime,
CLI shell routing, ShellExecute launch, WinExec readiness and process boot yields.
CLI routing also verifies propagation of the desktop namespace. The fresh locked
`flock /tmp/wine-build.lock bash tools/build.sh` passes. Initial fixture-binding,
CLI fixture-dependency and build literal-gate failures are retained in scratch;
the final checks pass without weakening build gates.

## One bounded ordinary session

No-guest controls exercised actual named-event and desktop authority/client
Workers. Unobserved and process-only preload controls passed; deliberately invalid
inherited Worker arguments failed as intended. Two real no-guest forks verified
isolated observer ports and unchanged guest command arguments. Actual guest
processes used observer ports8143/8144/8145, and each recorded its original inputs
and compile/instantiate identity. Instrumentation returned immediately in Workers.
The only original Play click followed a reviewed launcher image. First-child
GetMessage readiness completed after2036.980ms. The second child returned
`0x20001` from original FindWindowA at return50eae4, exited-1, and released its
readiness wait on exit after517.492ms; the original launcher then exited0.

Reviewed captures show intro footage, the promotion card, New Player, the entered
name Player, the main menu, Single Player options and the ordinary New Game level
loading screen. An attempted Easy click did not change the checked Medium value.
One premature ordinary click occurred while the promotion card was still visible:
a combined capture/input operation dispatched before visual review. Its compound
request delivered only the click, not the proposed characters; the correction and
receipt are retained in `input-review-correction.json`. Subsequent profile input
followed a reviewed New Player capture. Menu mouse presses initially acted on
the previous hover, opening Quit; Escape canceled it, explicit mouse movement
highlighted Single Player, and ordinary presses then opened New Game. No guest,
movie, map or registry bypass was used.

The engine reached its240-second finite bound at batch619767, with no logged
RuntimeError, trap or uncaught exception. The outer supervisor ended the host
group at255.029 seconds (status-9); this is harness termination, not an ordinary
engine exit. The final image remains **Loading...**, with progress beyond the
earlier loading capture. Final PNG610130 bytes SHA256
`cb87c167242444b8ffda0e43f116059db1a7fb7af805d11a43d23748427b4bf2`.
The concrete remaining limit is the bounded session ending during level load;
no new loading hang or engine-failure cause is established. No movement/look/fire
was attempted without a reviewed gameplay view. The next runtime step is a fresh
ordinary session with sufficient bounded time to finish loading and verify those
controls. No second session was run here; prior movie EOF reads remain unproven
as a blocker.

## Identity and delegated cleanup

All28 original installed files/39900850 bytes match before/after and in14 capture
states. All76 original registry values remain unchanged;13 child capture states
add only the guest-generated Demo Version string0.1. The final parent registry
is unchanged. Genuine file-only DSOUND.VXD/DDHELP, builtin DDRAW/DSOUND policy
and exact1024-byte path-guard files remain preserved. All220 staged runtime files
match after execution. All4161 sealed source inputs remain unchanged after the
session. The three actual process compile/instantiate receipts match the fresh
2081665-byte canonical module SHA256
`98203cd6549c75030d5d25118a61f7ca42449a05de0a2cf64e232bc82e6b0e7f`.
Source-seal SHA256:
`f67953c5c6a7fab7c6e55ff53cd53fee391f7cb3769d1a00bb680d57c48a5a57`.

All86 retrieved members match both stored and original byte/full-SHA manifests.
Archive8093464 bytes SHA256
`55ed02c8d2987a4e0460024f31a6d8ba26a2933616719cb073581c21f2d8bddf`.
Own boat `bx_xpmdqhug`, original expiry2026-11-03T08:21:33.867Z, TTL2400 and
shutdown owner `jedi-desktop-window-visibility` were recorded before use.
Following verified retrieval and scoped helper/controller absence, explicitly
delegated normal stop `stop_dfdf25b34aaa7a62` completed07:50:41.354Z,
error:null, forced:false, STOPPED with normal snapshot retained. No predecessor
boat was touched and no assigned boat remains running.
