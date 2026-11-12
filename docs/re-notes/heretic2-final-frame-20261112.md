# Heretic II final completed presentation: qualified observer, original attempt blocked

2026-11-12. Evidence: `scratch/runs/20261112-heretic2-final-frame-1945/`.
Continuation of [the runtime boundary](heretic2-runtime-boundary-20261112.md)
(`8f68731a1`). No production runtime change or guest patch was made. The matched
original exit witness remains **UNKNOWN**: the SoftwareGL control harness closed
before console close/resume; WebGL was not started. This is an experiment-control
blocker, not evidence for the cause of the native WebGL exit.

The parent recovery references remain authoritative: runs
`20261112-heretic2-current-paired-crate-onward-1110`,
`20261112-heretic2-current-load-exit-cause-1135`, and
`20261112-heretic2-runtime-boundary-1910`. Their closed save coverage, model-miss,
and successful API-tail observations are not promoted to causes here.

## Locally qualified mechanism

Run-only `retain.js` wraps the existing host GL bridge `_present` and native host
exit boundary. After an accepted presentation has replaced the host-owned layer,
it copies that layer's completed 2D RGBA pixels, with a limit of 1,048,576 pixels
and one retained frame. It records endpoint, HWND, window-object generation,
frame token, write sequence, completed sequence, attempt, dimensions, timestamp,
and identity binding. It selects the snapshot before forwarding the original
host exit. Recovery can encode the copied bytes after the renderer has retired.
It does not call the guest, query GL errors, or add a GL readback. It reads the
existing host layer, not guest-private structures.

`worker-frame.js` attaches passive owning-renderer endpoint/context generation
metadata to the original frame message. `page-retain-final.js` checks that
metadata against the frozen full22 identity, the actual Wine object/renderer,
and shared memory buffer. The identity includes the actual CPU Worker and
module, owning GL Worker/module/endpoint/context, window, and page canvas.
Missing, rejected, partial, stale generation, or changed identity produces
**UNKNOWN**, rather than selecting an older successful frame. A snapshot's
identity is checked again at exit.

Before allocation, Chrome tests exercised the real synthetic x86 producer →
GuestRpc → owning renderer Worker → GL host route, with the same current04
module, at 640×480 on SoftwareGL and WebGL. Two distinct completed frames were
produced, followed by ordinary public native `ExitProcess(8)`. Original stop ran
once and marked the synthetic process exited with code 8. Both recovered the
second, cyan frame, sequence 2, generation 1, frame token 14, write sequence 3:

- RGBA SHA-256: `1b63f59ea5652370e3fb9cea6fc084b5c0331c8ffaf49d3c22c79b694a983912`.
- Full PNG SHA-256: `372f37999cdcf52b6071d5c7cd46ee8432295756ecb1e16d09d274bb6a0df3dc`.
- `local-metadata-report.json` records actual endpoints/context epochs, module,
  native exit, original stop, pixel hashes, Chrome exit 0 and profile removal.
  The synthetic ordinary-exit route also reports its expected terminal fault;
  it is not a general exception-free or crash-free claim.

Focused tests cover once-only forwarding, original bitmap/return/exception
identity, observer-failure isolation, immutable copied pixels, all22 null
refusals, stale/partial/missing UNKNOWN, and zero additional `getError` calls.
See `qualification.json`, `final-qualification.json`, and the five run-only
`*-test.cjs` files. Full-size synthetic PNGs were reviewed and raw bytes checked.
Synthetic identity qualification and original full22 admission are distinct:
the synthetic producer does not supply a Heretic process identity.

An actual fresh-page preload test after provisioning caught a bootstrap-only
issue before any original launch: the parser-inserted script's load event did
not install the wrapper. The final helper installs during captured
`DOMContentLoaded`, before the app launcher. `preload-final-test.json` proves
one installation, zero apps at installation, zero installer errors, Chrome exit
0, and profile removal. Focused tests were rerun; the final package was frozen
and every provisioned byte verified before the original. No helper was changed
during the original run. This correction was confined to run-only observer
bootstrap code; it is not a proved emulator defect.

## Frozen original and concrete blocker

Runtime source baseline: `8a834a3dc7affc8c6e53245beab56e87a32b81e8`.
Both actual original CPU and owning GL modules were recovered and verified as
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Final provisioning verified 2,461 files including manifest/deadline, with actual
provision child wait 0 and separate stdout/stderr EOF. Final manifest SHA-256:
`e1c51d9466c827ea6ff10acfa44624d617f3e20e1913485bb76ec601a616ccd4`.
Full22, input, independent prearmed releases, transport, readiness and cleanup
controls were reused byte-for-byte by SHA in `final-qualification.json`.

SoftwareGL reached the original upright docks HUD 100. The exact parent save
set was mounted together and all four VFS readbacks matched:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| server.ssv | 2752 | ff4a137e73832727637341362347cf19544546bb37066f84eeb2fe81991efdb5 |
| game.ssv | 62728 | ee560ea612313f5e02afe6f3d28c595ff03ab5ac02ed185f4358f696d1b4ae14 |
| demodocks.sav | 1395332 | 96c82f5792edcc07fcf3758535bb8fe07b0eadbb90cffbb25e74ff5144fb6e23 |
| demodocks.sv2 | 90112 | 4f5ad19939f1ac901f058949f06ccea0d52da29f4ac205f1c51014bb6a6af3d9 |

Only normal native `load crate0400` was typed, reviewed in the native console,
and executed once. Every dispatched key had acknowledged down/up and an
independent release armed before down. There were no cheats, guest state writes,
new native saves, fallback substitutions, or overwritten original saves.

Eighteen full PNG captures have nonnull full22 identity, matching CPU/render
module pins and actual SoftwareGL context. All were reviewed in full. The last
completed screenshot, `saved-assets-wait`, was captured at
20:11:23.708Z (completion 20:11:24.096Z), SHA-256
`26c06915e039c73f905d780637bb6bfc78f4365c22a7a45bd5ed6088233aa3a3`.
It shows the native console's loading/player/server messages, Silverspring
Docks, blank prompt, and a Paused banner over a black lower world. No new visible
native error was found there. This screenshot is not an exit-bound retained GL
frame and does not prove loaded-world survival.

At the next console-close request, the reviewed capture exceeded the unchanged
120-second freshness bound. Reply 17 was `refused-before-dispatch`,
`STALE_SCENE_BEFORE_DISPATCH`, `effects: 0`. The guard closes its identity chain
on this refusal. A subsequent read-only capture encountered `closed or
concurrent chain`, terminated the browser, and made the caller transport
terminal. No uncertain input or original load was replayed. The original
SoftwareGL browser parent actually waited code 1 with both stream EOFs. Chrome
closed code 0 and its profile was removed. `retained-read-error.json` records
`terminal: protocol closed`; there was no native exit event or retained exit
payload to bind. Neither original final pixels nor WebGL exit ordering is
claimed. `blocked-evidence-check.json` checks this boundary explicitly.

## Recovery, lifecycle, and next permitted witness

`compressed-evidence-manifest.json` maps 226 original paths to 185 unique gzip
blobs in `recovered-blobs/`. `retrieval-verified.json` verifies compressed and
uncompressed sizes/SHA-256 before normal shutdown. `RECOVERY.md` gives the
materialization recipe. Source recovery uses Git plus binary patches for
relevant dirty source and owned run helpers; no source tree, scratch tree, or
media archive was created. Media is referenced by existing path and SHA.

Private box `bx_prcjnjvr` had an observable independent two-hour watchdog armed
before creation. It was archived normally at 20:16:17.414Z after evidence
retrieval: expiry null, receipt `stop_699d2f4207f5aeb9`, completed, forced false,
error null. The original lifecycle tool session reported 143 without the manager child
wait/EOF artifact; the manager join and orphan watchdog join remain **UNKNOWN**.
The delegated recovery stop has its own actual parent wait 0 and both EOFs.
There is no all-zero lifecycle claim and no inherited-box action.

The next permitted witness is a fresh matched pair using these frozen helpers:
complete the reviewed SoftwareGL normal load/resume and released controls, then
WebGL exact whole-four normal load, retrieving the pre-host-exit snapshot before
CDP teardown. Keep each input within the capture's existing freshness bound;
if it ages, stop before submitting input and take a fresh reviewed capture.
Do not retry this terminal chain or weaken its guard. Compare retained frame
completion with the native exit event/API-entry timestamps; pre-host-teardown
selection alone does not establish that the frame preceded native API entry.
Review the complete recovered original PNG without assuming it contains an
error. Only a visible diagnostic or concrete permitted runtime violation can
justify a focused repair and matched before/after. No runtime patch is justified
by this attempt. No full27, parity, FPS, audio, or general crash-free claim.
