# Diablo II: next bounded evidence run

Source-only readiness for `GAMEPLAY-diablo-2-demo-installer`, against main
`a53f43dba7a884a7a53a4c86172d3226aa69f5c3`. No guest, browser, build or remote
lifecycle was run. Root owns runtime scheduling and task ledger edits.

## Ready inputs; no recovery download needed

`/home/user/wine-assembly/test/binaries/candidates/diablo-2-demo-installer/`
contains the original installer plus all 25 registered installed files:
273,687,687 bytes total; installed payload 135,378,002 bytes. The companion
`diablo2-fixtures-20261019.json` records every exact path, size and SHA-256.
All 26 files were freshly hashed. The installer, game EXE, d2data, d2music and
Storm match the historical independent pins in `diablo2-demo.md`. The other
hashes are current local identities, not newly established installer provenance.

Run `node tools/verify-diablo2-readiness.js` before admission and after exit.
An alternate candidate root is its sole positional argument. This performs
read-only hashing and exits nonzero for missing/changed files; it neither
launches nor fixes anything. Positive 26-file verification and negative
missing-root refusal were checked, plus Node syntax. Link or reuse the existing
candidate directory in the serving checkout; do not duplicate 274 MB or rerun
the installer. Its 138,309,685-byte original remains a recovery source if the
installed tree is later lost.

## Correct route and current completion boundary

Launch `diablo2_demo`, whose registered VideoConfig seeds select Direct3D
(`Render=1`, both hives). Runtime loading of `d2direct3d.dll` establishes that
selection; presence of the statically imported `d2ddraw.dll` does not.
`diablo2_glide_demo` is another renderer; `diablo_shareware` and
`tools/diablo-gameplay-bench.js` concern Diablo I and cannot answer this task.

Main already contains generic point support
`782bc73d43c248766c2e24a27b8231cb000a6a44` (ancestry checked). The last sections
of `diablo2-demo.md` record ordinary GPU and software town/movement evidence,
zero measured candidate fallbacks, and limitations. The old task's instruction
to characterize the 31,077 point fallbacks is superseded. The Oct 13 raw run
directories are unavailable in the shared/integration checkouts; this packet
does not reconstruct them or upgrade their historical claims. The available
`scratch/runs/recovered-diablo-2-demo-installer-309da8c3885f0a42/`
is a Sep 29 Glide screenshot provenance packet, not current D3D validation.

The state-driven input reference is `test/test-diablo2-demo-gameplay.js`:
skip intro, Single Player, double-click Barbarian, focus name, type a name,
OK, wait for town, then click reviewed open ground. Its 640x480 normalized
coordinates are (320,164), (315,210), (320,422), (553,442); scale to the
actual canvas bounds, never to the browser viewport. Review terrain and both
orbs plus a before/after movement pair. CLI default stops at Act I load;
`DIABLO2_FULL_ROUTE=1` is necessary for CLI town, but CLI frozen/batch time
cannot qualify browser audio or real-wall logical FPS.

## Next runtime: default-Worker town audio

The smallest useful next run is one ordinary default-Worker browser session
to town, then a 30-second output recording spanning idle and ground-click
movement. This closes an open user-visible quality question without inventing
an unqualified logical frame boundary. Use root's existing guarded loopback
browser route, actual browser executable/dependencies and canonical build;
require explicit runtime grant. Fresh admission must preserve the 2 GiB disk
floor and the coordinator's stricter margin. Suggested outer cap: 300 seconds,
32 MiB retained recording/log budget; terminate the owned process group at the
first guard, preserve failure receipts, do not automatically retry. Route can
time out under load: that is incomplete evidence, not a game failure.

Use normal trusted input to unlock audio and the existing page recording UI
(`toggleRecording` in the browser harness; `lib/recorder.js` taps the audio
contexts). Capture the actual selected Worker/render backend, audio context
state/sample rate, console, exact served JS/Wasm hashes and original fixture
hashes. The established `tools/record-probe.js` demonstrates recorder APIs but
is NOT a drop-in town driver: it records immediately on launch, is headless,
disables GPU and bypasses autoplay. Running it unchanged would not qualify
this requested default browser route. A harness should attach recording only
after the reviewed town/movement route; no guest-memory or pacing edits.

After capture, with existing ffmpeg/ffprobe only, inspect the audio stream
and run `node tools/audio-loop-check.js RECORDING --from=0 --to=30 --json`.
The checker reports silence separately and detects sample-exact short loops;
neither a non-stuck classification nor an audio track proves audible music.
Listen to retained output for music/effects, gaps and repetition. Report output
capture quality separately from physical speaker/device playback, which stays
unqualified unless actually observed. If ffmpeg is absent, preserve the media
and defer analysis; no installation is part of this packet.

Record two reviewed town stills and the recording first, then publish the
`result.json` per `ops/README.md`. Verify owned process-group exit and fixture
hashes before releasing the runtime slot. No public deployment is needed.

## FPS and optimization follow-up

Optionally, in a separate idle 10-second window with recording stopped, attach
`tools/measure-gameplay-presentations.js --cdp=URL --url=EXACT_PAGE_URL
--scene="Diablo II town idle" --out=RUN_DIR --seconds=10 --windows=1` to the
page launched with `?debug&perf&perf-stream`. Use a server supporting the
optional telemetry sink or retain/document its overhead. The sampler validates
visibility, identity and monotonic counters; its output is presentation events
per real second, with logical/display FPS explicitly null. Do not call the
recorder's encoded frame rate game FPS or compare random new towns as a
renderer speedup.

Logical FPS requires a separately qualified gameplay simulation boundary.
The documented d2win `0x1000b670` QPC limiter is established for menu/loading,
not a proven town simulation counter. Do not instrument that address and label
it logical FPS. A source/per-module disassembly investigation of the original
gameplay frame boundary is the next prerequisite if that metric is prioritized.
No new interpreter optimization is justified by this readiness audit; new
variants would need the native-code and matched benchmark workflow in CLAUDE.md.
