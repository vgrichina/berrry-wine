# Recoil manifest-bound native objective, 2026-11-08

Run: `scratch/runs/20261108-recoil-manifest-bound-objective/`.

This continuation authorizes one fresh original with the manifest-bound
`launch-v2.py` from predecessor `0d8587810`. The prior pre-Chrome failure is
closed. The seven timing/native-image controls, six full-browser controls and
focused actual-browser launcher fixture are reused by path, size and SHA-256;
none of those accepted suites is repeated.

Before allocation, every one of the 757 pins was read from its exact provider
and checked for size and SHA-256. Published source is
`49874a81c5ae180c20a15c6bb169d9041f028cae`; module SHA-256 is
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
Peer WIP is excluded. The unchanged corrected launcher selects explicit
`PIN_FILE` and preflights the real hermetic preloader plus transitive HUD decoder
with the same environment construction used for execution. A deliberately wrong
ambient manifest is overridden. `closure-check.json` retains these checks.

Exact Git identity, relevant binary diff, small owned-input patches, retained
Wininit patch and existing media path/hash references provide recovery. No source
or media archive is created. No production source change or build is claimed.

The one UUID-idempotent allocation is `bx_ha493bhx`, created at
09:44:28.175Z, initially expiring at 10:10:28.022Z. Independent normal-stop and
25-minute watchdog processes were observably armed before allocation. The
immutable watchdog deadline is 10:09:27.827Z. All 757 remote pins pass again;
the launcher starts its only original Node PID 8178 at 09:44:49.207Z after the
real remote preflight passes. Local heavy execution holds `wine-runtime.lock`.

The browser reaches native Software selection, Start, NEW GAME, user and Medium,
then ordinary START. Relative native pointer reads and reviewed corrections are
retained. Native 1.1 Operation Short Circuit is visible during loading; the
predecessor's 1.1 power-control/map versus 1.3 rocket distinction remains settled.
No briefing cycling input is sent. Loading, briefing, map and inventory are not
pause.

## Native outcome and first demonstrated integration boundary

`review/living-check.png` shows health **100**, timer **00:00:03**, and the tank
on the beach route at 09:52:40.266Z. Ordinary Escape is independently released;
`native-pause.png` visibly shows native MENU at 09:52:57.791Z. Reviewed relative
movement highlights Resume in `resume-ready.png` at 09:53:21.165Z.

Command 25, `ordinary-hud-gated`, is the only compound attempt. Resume DOWN is
09:53:36.301Z and UP 09:53:36.442Z. The unchanged compound-v3/browser-v4 retain
separate 4,500-ms transition and bounded command windows, immutable overall
deadline, <=250-ms freshness and the temporal pair. The first HUD candidate's
image starts at 09:53:40.180Z; its post-image identity/byte validation completes
at 09:53:42.019Z, **1,839 ms** later. It is stale and cannot admit a key. The
independent gate timer sends Escape at 09:53:40.802Z, UP 81 ms later. Receipt
`actionDue` is null, `gateQualified` false, and `attempted` empty. The command
has an exact ACK, which acknowledges completion of the bounded attempt, not
native ordinary consumption. All **27 commands** have exact ACKs; zero UNKNOWN.
There is no repeated Resume, second original, gameplay C/M/arrow DOWN, attack,
guest write, private handler or forced scene/configuration/clock/seed.

The independent observer captures returned living HUD health 100, timer
**00:00:05** at 09:53:38.506Z, and actual native MENU at **09:53:42.464Z**.
`review/ordinary-consequence.png` independently captures that final native MENU.
The native-menu interval from its first visible capture to Resume DOWN spans
**38.510 wall seconds**. The enclosing living readings span **58.240 seconds**
while the displayed timer advances two seconds; this supports excluding menu
time, without measuring exact actor freeze or exact active duration. The
observed post-Resume HUD interval through 09:53:41.183Z spans 2.677 seconds with
the same displayed 00:00:05. These coarse timer readings are not simulation FPS.
Briefing/loading/map/inventory time is never counted as paused time.

## Tested generic snapshot correction

The newly reached boundary demonstrates that exact module/owner validation can
consume the freshness lifetime of a returned HUD image. The original launcher,
757-pin manifest, compound and browser remain unchanged. New run-local
`bound-input.cjs` / `compound-v4.cjs` move pixel acquisition into the final
validated page snapshot. Each probe still performs **two complete** identity
reads, including actual guest and renderer byte retrieval/hashing, exact Worker
instance/renderer epoch checks and final page-reference comparisons. Nothing
is cached between probes. The final page references and canvas are read within
one synchronous page evaluation; its conservative host-start timestamp includes
that evaluation and image encoding latency. Slow final encoding still fails the
250-ms limit. No input, freshness, temporal-pair, deadline, release or UNKNOWN
rule is relaxed.

`make-correction.py` reconstructs these small run inputs. `correction.patch`
records the focused changes against retained inputs; `owned-inputs.patch`
recovers the small setup and focused check scripts. The new local fixture
manifest is distinct from the unchanged original's 757 pins.

`snapshot-browser-qualification.json` tests the actual full browser entry with a
new generated source-read-stall fixture and retained native image assets. Each
actual `Debugger.getScriptSource` response is delayed 750 ms; bytes and identity
responses remain real. The unchanged probe reproduces stale HUD ages of
779–808 ms and admits zero gameplay. The corrected probe qualifies a fresh
native-image temporal pair at **3,200 ms**, age **33 ms**, within the unchanged
4,500-ms gate. Trusted generated C DOWN is at 3,234 ms, UP 81 ms later; Up DOWN
at 3,317 ms, UP 2,001 ms later. Overall Escape is independently released. These
are generated fixture events, never native Recoil consumption or route evidence.

`snapshot-identity-qualification.json` passes seven focused new snapshot cases:
changed final page owner, guest instance, renderer epoch, actual module bytes and
detached Worker all reject; the co-located temporal pair qualifies only after
12 full guest/renderer source reads across its three probes; 308-ms final image
encoding remains stale. The accepted predecessor seven/six suites and focused
launcher fixture are reused without repetition. Both new browser processes exit
0; Chrome PIDs, HTTP/CDP ports, profiles and writers are drained.

## Retrieval, shutdown and closure

All **346 remote file references / 33,820,191 bytes / 281 unique SHA-256 values**
are matched to existing retained inputs or uniquely retrieved, then independently
read and rehashed before normal shutdown. All **55 PNGs** pass CRC decoding.
The initial immediate post-quit inventory sees the launcher PID still draining
and fails before collection. That diagnostic is preserved. A distinct later
read-only custody check confirms all owned launcher/Chrome/observer PIDs absent,
ports closed, profile/writer absent and released inputs before retrieval/stop.
No input is replayed because of that diagnostic.

Normal delegated stop archives **bx_ha493bhx at 09:55:39.913Z**, expiry **null**.
Receipt **stop_f35c84a11147c5a6** completes at **09:55:39.932Z**, forced false,
error null. `final-stop-receipt.json` independently inspects that state. Both
normal/watchdog children exit 0 and the supervisor ends with no children. Local
fixture PIDs/ports/profiles/writers are drained and the runtime lock is released.
Disk remains above 5 GB. No old box is resumed/deleted, no public deployment or
subworker is used, and peer WIP is excluded from this documentation-only commit.

The task closes on the substantive tested generic snapshot integration repair.
Native ordinary C/M consumption and reviewed ramp/control movement remain open;
no actionable target was qualified and no attack occurred. Another original
requires fresh authorization. Objective completion, full27, parity, audio and
simulation/game FPS remain open.

Owned evidence containment, required fields and artifact existence pass. The
repository-wide checker retains seven unrelated containment errors in older
peer runs; they are preserved rather than edited here. `verification.json`
checks the original receipts, hashes/PNG CRCs, cleanup and focused corrections.
