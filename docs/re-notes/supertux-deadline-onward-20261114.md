# SuperTux: deadline repair passed controls; native attempt stopped before input

Evidence: `scratch/runs/20261114-supertux-deadline-onward/`.

The run-local controller repair passed its controls, but this task did **not**
reach gameplay. The one original reached a personally reviewed title menu.
An additional finite transport relay introduced by this worker expired before
any DOWN was admitted. The controller retained its sticky failure and the
original was shut down through supervisor SIGTERM. There is no fresh level
baseline, Options Jump/Run review, story entry, movement, jump, new terrain,
enemy interaction, level exit or native Quit. Full27 remains unproved.

## Controller repair and real guard controls

The fresh helper separates the selected **40–1,000 ms pulse** from its
immutable operation deadline: `min(admission + 4 seconds, capture + 12 seconds)`.
The original runtime lease also bounds admission. An independent UP child is
armed before DOWN, with that fixed deadline as fallback. A consumed ACK supplies
`consumedAt + pulse duration`, which can only shorten the fallback. No active
operation/session was extended. The predecessor controller, CANCELLED receipt,
intent and sticky terminal evidence retain their recorded hashes.

The final control fixture used the actual production HTTP server and input
guard, with **150 ms before consumption**. One **60 ms Down** was consumed;
normal independent UP followed about 60 ms after consumption, with subsequent
fixture progress. Thus transport was given a practical deadline without
lengthening the normal pulse. Arm preceded the request and consumption.

A separate actually consumed DOWN with a deliberately dropped ACK became
sticky UNKNOWN at the actual HTTP timeout. Independent fallback release ran;
further input/capture were refused and no nonce was replayed. Another actual
guard deadline expired before consumption; delayed consumption retained
CANCELLED/consumed=false. A separately prearmed UP ran without a parent release
schedule. All three final controller controls passed, with actual fixture
native/watchdog/supervisor-child waits 0 and separate EOFs. These fixtures do
**not** establish original guest gameplay or guest progress.

Four supervision controls passed normal exit, invoking-tool loss, parent
SIGTERM and deadline termination. The outer-wait control also passed actual
native/watchdog/supervisor-child waits and separate stdout/stderr EOF.
A separate HTTP-relay check passed delayed DOWN, undelayed UP, production-guard
consumption/progress and actual relay-child wait. Its fixture lifetime was two
seconds. Logs from earlier successful helper revisions remain preserved.

## Exact native blocker

After the occupied Quake II turn, locked preflight passed and the original
launched at **14:04:50 UTC** with fixed **1,200-second** CLI/controller limits
and a prearmed independent **1,220-second** watchdog. Two black startup captures
received no input. The full title menu was personally viewed in `title-menu.png`
and later `title-fresh.png`.

The worker added a **20-second** HTTP relay for an intended original-guest
150 ms delayed-transport proof. The first new Down choice reached admission at
review age **14.408 seconds**. It was positively **NOT_SENT / VALID lease**,
before independent-release arming or DOWN; its intent and nonce remain intact.
A fresh capture was taken and reviewed for a new choice, without replaying the
old intent. But the relay's immutable lifetime ended at **14:06:33.089 UTC**.
The new choice attempted lease inspection at approximately **14:06:35.912 UTC**
and received connection refused, before intent/nonce creation, UP arming or
DOWN. The controller wrote its permanent noReplay terminal record.

The relay log contains only the first lease snapshot. The native log contains
**zero input-dequeue and dispatch-input entries**, and there are no native-run
DOWN/arm receipts. The intended original delayed-transport proof was **not run**;
`verify_native_delay.py` was prepared but never executed. No production-guard
UNKNOWN is claimed for this original. This is a worker-introduced relay lifetime
and review timing blocker, not evidence of a guest/emulator defect. No sticky
failure was cleared, owner rebound, intent reissued, deadline extended or
second original launched.

## Actual cleanup, identity and publication

`cancel-request.json` caused supervisor SIGTERM; the native log explicitly
records orderly shutdown and **139.749 seconds** of runtime statistics. This
is distinct from selecting native Quit. Native runtime, independent watchdog
and supervisor child were each actually waited **0**, with separate stdout and
stderr EOF. The watchdog exited on the native-wait receipt without firing;
the heavy-runtime lock was released. The relay child also has actual wait 0
and both EOFs, and its invoking tool returned exit 0. The detached outer
parent's own external wait/separate EOF remain UNKNOWN; the durable
`outer-child-wait.json` records its supervisor-child wait only. Absence checks
are supporting cleanup observations, never substitute waits.

Launch HEAD: `8c665476fd402b9ac824ca6bfd7f73e4d71aeb20`.
Module SHA-256:
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
The accepted **317-file** source closure and module exactly matched the earlier
locked full build; that build was reused. Fresh shared-WASM input-owner,
22 guarded CLI and clock controls passed. All **787** media files, original
bundled DLLs, standing authentic CRT and **786** manifest mappings passed.
Postflight found zero source/module/media drift. The registered SDL/datadir
route, cwd and authorized existing `--real-ticks` stayed unchanged. No direct
profile, configuration, state, clock or physics edits occurred.

Two selected personally reviewed title PNGs passed CRC, inflate, size and SHA
checks. Black captures were removed with metadata retained. Compact logs,
JSON, exact Git SHA, relevant uncommitted binary diffs and new-helper patches
retain provenance; no source/media archives or frame series were created.
No production code or foreign WIP changed. No downloads/deployment occurred.
Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt **not
applicable**. This is a docs-only publication; detailed publication and cleanup
records are in the run directory.

The controller fixture repair is useful evidence, but the requested onward
native gameplay remains undone. A future separately authorized launch needs
a transport-helper lifetime fixed to its session before review begins. This
terminal run cannot be resumed. This single-task worker stops after publication.
