# Heretic II WebGL: original completed exit-bound pixels recovered

2026-11-12. Run `scratch/runs/20261112-heretic2-webgl-exit-witness-2055/`.
The original WebGL normal `load crate0400` called native **ExitProcess(8)**.
The frozen observer recovered a **completed 640×480 owning-GL frame before
host teardown**, with all 22 identity fields matching the last admitted
original capture. The entire PNG was reviewed: it shows normal native load,
player/server/loopback and Silverspring Docks messages, a blank console prompt,
and Paused over a black lower world. **No visible error diagnostic was found.
The reason for native exit remains UNKNOWN; no runtime repair is justified.**

This continues [parent2040](heretic2-contained-exit-20261112.md),
[parent2025](heretic2-webgl-final-20261112.md),
[the final-frame observer](heretic2-final-frame-20261112.md), and
[the runtime boundary](heretic2-runtime-boundary-20261112.md).
Parent1910's whole-four/current04 living SoftwareGL HUD31/backward/released
control remains prior reference, not a new pair. Root artifact reviews remain
pending and were not duplicated.

The recovered presentation is attempt 676, completed sequence 666, generation 1,
HWND 65537, endpoint 1, frame token 3100482, write sequence 1354. PNG SHA-256:
`8e327f9363013f64a1e51c6f1bc7ac36f58c8b4947a3dc06acf007c10d8b3d63`.
RGBA SHA-256:
`6925c7246950e148bbb90ddc05b1d97fee83ec67804406b4b9d989c2bdaab596`.
Decoding the complete PNG reproduces all 1,228,800 retained RGBA bytes.
The observer accepted a completed current-generation presentation, not a
late screenshot of a retired renderer. The console/Paused content differs from
the earlier console-closed screenshot; these are distinct observations, not
proof of a loaded living world or a native diagnostic.

Observed wall timestamps, all on 2026-11-12:

| Observation | UTC |
| --- | --- |
| Final completed owning-GL pixels | 21:11:11.032 |
| Native ExitProcess API entry, argument 8 | 21:11:11.037 |
| Host-exit frame selection, argument 8 | 21:11:11.038 |
| Page exit notification received, code 8 | 21:11:11.059 |

Thus the retained completion timestamp precedes the observed native API entry
by 5 ms and host-exit selection by 6 ms. The native API tail independently ends
with ExitProcess(8). Its last recorded `wglSwapBuffers` entry is .009 with
successful return 1; that entry timestamp is not a presentation-completion
timestamp. `exit-frame-analysis.json` checks the ordering and exact identities.

The runtime/media closure reuses parent2040's verified pins, retaining baseline
`8a834a3dc7affc8c6e53245beab56e87a32b81e8` and actual CPU/owning renderer module
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
The exact old renderer-input.js remains the parent's regular contained
187,872-byte provider, SHA
`4235d20d7fc2404b38f6e4f7f80c92d5f94f1513b4d6d7dcf04be34162a4b087`.
Shared renderer/current main were not modified. Nineteen observer/browser,
control and freshness files match their qualified SHA. Existing provider
positive/negative and real121222ms freshness proofs were reused by SHA;
no solved setup matrix or synthetic qualification was repeated.

Actual provisioning joined 0 with both EOFs and verified **2,458 files**,
including manifest/deadline. The runtime/media pins are unchanged; seven fewer
run-only preparation/test helper files account for the count relative to
parent2040's 2,465. Manifest SHA:
`200e81a9262558a910d9c65caa57c46f171a5c85811ce3c9db035174d101a273`.
The original followed native Main → Game → Easy, reached upright docks HUD100,
mounted all four unchanged preferred crate0400 files, verified complete VFS
hashes, typed/reviewed only `load crate0400`, executed once, closed the native
console, and used the established native physical pause toggle to resume.
The console-open screenshot has HUD96; no health or timing match is claimed.
Eleven full bound PNGs were reviewed. All admitted inputs passed unchanged
120-second freshness, exact reviewed label/SHA, full22 identity and release
controls. No stale/UNKNOWN input was retried and no guard was weakened.

Native exit triggered pre-teardown pixel recovery and ordinary Chrome closure
(code 0, profile removed). The pending resume request's later screenshot failed
with CDP closed; its browser parent actually joined **1 with both EOFs**.
The pulse itself had acknowledged down/up and prearmed independent release.
There is no resume screenshot and no replay. A premature terminal compression
command failed on the then-missing parent-wait file before writing anything;
it was not resubmitted. Once actual join was observed, a separate read-only
closed-output hash inventory and streamed downloads recovered **136 unique
blobs / 161 paths**. Local streaming gzip and raw/encoded checks preserved them;
compression was local, not before transfer. No evidence about the failure was
replaced by a successful all-zero claim.

All unique recovery preceded normal stop. Box **bx_42896ath** had a fresh
independently observed two-hour watchdog before creation, initial expiry
2026-11-12T22:59:37.214Z. It was normally archived at **21:12:37.081Z**, expiry
null, receipt **stop_620e557b0869ed60**, completed/unforced/error null. Stop,
manager and watchdog actual parent waits were 0 with both EOFs. No inherited
box was touched. Capacity was locally above 1.5 GB before allocation, launch,
and admitted input; later shared disk use dipped after input finished. No
reserve change, RAM gate, root cache change, extra worker or public hosting ran.

`RECOVERY.md`, `evidence-check.json`, `exit-frame-analysis.json` and
`retrieval-verified.json` preserve recovery and scoped checks. Git SHA plus
relevant binary diff and owned-new-helper patches recover source; original
media stays existing path/SHA references. No source/media archive, guest RE,
disassembly, extraction, patch, substitute DLL, private guest-structure access,
forced guest call, extra console command, config/clock/AI/health/position/state
write, or new save was performed. No full27/parity/FPS/audio/general crash-free
claim follows. The requested original exit-frame witness is complete; a future
cause investigation needs distinct permitted runtime/API evidence, since this
image supplies no visible error to repair.
