# Uplink earned-checkpoint onward attempt — 2026-11-12

The first causal failure was a strict full-frame capture identity transition
immediately after normal Load: **`renderEndpoint` changed from `"none"` to `1`
across the screenshot**. The native Load click received DOWN and UP
acknowledgements, but the capture was refused and the command stream terminated.
No loaded-world, fresh-movement, onward-room, actual GL-owner/backend, or successor
save qualification follows from this attempt. This is a caller capture-boundary
failure; it does not establish an emulator defect or a failed native save.

Run: `scratch/runs/20261112-halflife-earned-onward-1500/`.

## Checkpoint and staging

Before staging, independently verified the authoritative gzip export from
[the earned native checkpoint](halflife-earned-cross-session-save-20261112.md),
commit `6a7d68ac5`, including compressed size/SHA-256, exact four-path membership,
base64 decoding, and every complete file size/SHA-256. The files total324084 bytes:

| Native path under `c:\valve\save\` | Bytes | SHA-256 |
| --- | ---: | --- |
| `half-life-000.sav` | 164727 | `7df87bd87c7e0b46f5bad250407bd13c6d8cf6fab2e0e0e82521f3ccbf54b346` |
| `hldemo1.hl1` | 158093 | `6b12dc054d01297200cb2684c6332ad103960bf3fa689d080a972ce743bd67bf` |
| `hldemo1.hl2` | 1260 | `591db0add36af1d53b4d71b4899a715e176388ff4c005dfe43600b280c32b48a` |
| `hldemo1.hl3` | 4 | `df3f619804a92fdb4057192dc43dd748ea778adc52bc498ce80524c014b81119` |

`checkpoint-independent-verification.json`, `restore-mounts.json`, and
`restored-save/` preserve this run's unchanged input bytes. Prior1430 root review
was pending at assignment; it was not assumed complete here. The fresh browser's
read-only host VFS collection proved the exact four mounted hashes before Load
(`recovered/webgl/restored-save-set-verified.json.gz`).

All65 original media files passed local hashing. Original `hldemo.exe` remains
`e459ef7d19bc0690d2e2d6dca9af1d773b49f8172096e49a694f897119bc4dc1`;
`pak0.pak` remains
`c9eac1391845d6fabd93d7a1cc48281275410d35e01b74bd7f02325c65c99a42`.
DLLs use ordinary mounts. Joined provisioning independently verified all574
staged files, including the save files and mounts, followed by the actual staged
import gate before Chrome startup. No replayed opening or substituted save was
used. Native Load listed UPLINK elapsed00:45.

Frozen source commit is `6a7d68ac54c261482faafee46b36aeeaf4f48015`.
`relevant-source.patch`, `relevant-untracked-source.patch`,
`new-helper-patches.patch`, `final-helper-patches.patch`, and `runtime-pins.json`
retain relevant dirty source and run-specific inputs, including the staged
untracked `lib/wininit-boot.js` whose frozen hash was rechecked.
Git remains the source archive; no source-tree/media archive was created.
The observed guest module is current
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
The owning GL renderer was not qualified before termination; the SoftwareGL
launcher selection and native OpenGL panel do not substitute for that proof.

## Exact failure and preserved limits

Fresh full frames show the normal main menu, Configuration/Video, OpenGL/Default,
640×480 selection, return to main, and highlighted UPLINK in Load game.
`review/webgl/o13-loadlist.png` is the last successful full frame.
For `o14-nativeload`, the reviewed capture was9838ms old at admission. Both
mouse edges acknowledged; its pulse and admission receipts are recovered.

After the500ms wait, the state read began at15:05:16.015Z with no observed GL
renderer yet. During `chain.capture`, `same(before.identity, after.identity)`
at `bound-input.cjs:138` refused `1 !== 'none'` for `renderEndpoint`.
`recovered/webgl/terminal-error.json.gz` retains the stack. No successful
`o14` screenshot/capture binding was published. API operation8426 exited1 with
`runtime first fault`; `failed-operation-read.json` is a read of that same
operation, not a resubmission. The post-Load scene/outcome remains unqualified.

The caller's automatic owning cancellation stopped the supervised browser tree.
The delivery fallback cancellation separately refused the already-sticky caller
state; no later CDP/gameplay command was sent to work around the guard. Kernel
custody completed339/339 owned process reaps, with no remaining/unreaped process
and complete command EOF. Actual browser outer parent waited1; both output EOFs
were retained. No ordinary Chrome exit0 receipt is claimed.

`postflight.json` verifies177 recovered artifact references, compressed evidence
round trips, all four local/mounted save hashes, and30 trusted native mouse events
(10 balanced clicks). The original save remains reusable and unchanged; this
run produced no new native Save/export continuity. Prior
[paired WebGL red-crate arrival](halflife-current-paired-onward-20261112.md) stays
separate and unchanged. No guest state writes, console commands, media/config
patches, forcecalls, FPS, parity, audio or full27 claims were made.

The next fresh attempt should make its initial post-Load capture after renderer
startup has settled, preserving every within-capture identity check and all22
postbinding fields. It must still prove normal Load, actual GL ownership and fresh
movement before onward play. Do not reuse this terminal command stream.

## Tests, resources and shutdown

Local tests passed before allocation: exact staged import positive/negative
closure,102 actual generated key/wait forms,16 binding negatives, three
independent-release tests, corrected read-only `wine._helpCtx.vfs` collector and
actual emitted exporter fixtures. The21-second delayed ACK/same-operation read,
API execution1/600 boundaries, invalid-envelope rejection, and unknown accepted
POST no-replay tests passed. No production code changed; no new build is claimed.

The initial allocation sample was1548836864 free bytes on `/home`, above the
1.5GB floor with a measured24MB evidence bound and16MB cleanup reserve. Commands
rechecked disk and owned evidence size; reviewed JSON and command records were
compressed incrementally with round-trip hashes. The minimum recorded sample
was1548836864 bytes; postflight sampled1872179200 bytes. No RAM gate was used.

An observable independent two-hour watchdog was armed before allocation.
After unique evidence retrieval and hash verification, delegated normal stop
completed. Box **`bx_73dhahdt`** is **archived**, stopped
**2026-11-12T15:06:02.858Z**, expiry **null** (initial
**2026-11-12T17:01:42.449Z**). Stop receipt
**`stop_a6e53c343879a615`** completed, forcedfalse, errornull. The manager and
independent watchdog both have actual parent waits0 and both EOFs. No box was
deleted, resumed, or left billing idle; no workers or public deployment were used.
