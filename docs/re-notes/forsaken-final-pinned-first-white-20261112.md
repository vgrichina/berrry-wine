# Forsaken first combat-white producer transition, 2026-11-12

Fresh original Forsaken reproduced the white viewport through the tested
nonblocking diagnostic ACK path. The selected pixel's first retained transition
to white is a natural additive textured submission. The next scene submissions
already carry additive state, although the CPU trace continues recording
successful execute-buffer opaque-state restores. The missing witness is the raw
state at draw enqueue and replay: this run cannot locate where those values
diverge. No emulator bug is proved, no production patch was made, and there is
no changed-original before/after claim.

Evidence: `scratch/runs/20261112-forsaken-final-pinned-first-white-1605/`.
Read the [1550 harness handoff](forsaken-nonblocking-diagnostic-20261112.md),
[first-white attempt](forsaken-first-white-20261112.md), and
[owner/enemy observations](forsaken-owner-enemy-20261112.md) for predecessor
limits. This run supplies the previously missing original combat trace.

## Frozen inputs and original route

All helper edits finished before pinning and allocation. Browser, CPU observer,
shared ACK cycle, requester and telemetry helpers are byte-identical to 1550.
`reused-controls.json` records exact input/log hashes for the combined 21-second
drain controls, periodic admission/budget, bounded retention, native release,
API custody, observer checks and locked build. Their unchanged runtime closure
was checked; these full controls/build were not unnecessarily rerun.

The actual `Transport.provision` local validation path checked the full final
closure and first source descriptor before a sentinel stopped it before any
external operation. A deliberately stale final pin was rejected before that
boundary. Python syntax/safe imports and the JavaScript transitive import/data
preflight passed. Helpers were frozen read-only and reread. The lifecycle caller
reran the full byte preflight immediately before allocation. Provisioning checked
all 1,557 uploaded paths, including final pin/deadline metadata; remote full-pin
and import preflight passed before Chrome. There was no stale-pin retry loop.

The source base is main `bc8f9c861f277acf2fd2c1a34061eb569d5d69b4`, plus
`relevant-source.patch.gz` / `untracked-runtime.patch.gz`. Helpers are preserved
in `owned-inputs.patch.gz`; `patch-recovery.json` supplies exact raw hashes and
sizes. Git remains the source archive. Existing original media paths/hashes were
checked without a media/source tree archive. The original executable remains
SHA-256 `366ec5d0943daca839836296f9fb52724e94dc155630c6b0c30d7181106b5e24`.
Recovered guest and renderer module bytes match
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.

Normal Enter pulses traversed Single Player, START, VOLCANO and the briefing.
Native a600/a700/a300 approached the corridor. `corridor.png` shows the hostile
craft and incoming projectile, five lives and SHLD128/HULL128. Control1800's
`primary-combat.png` at 16:10:57.524Z is nearly white; the passive full capture
at 16:11:16.244Z is white except for the lives display. No secondary fire was
needed. These are ten completed full 1024 × 712 frames, eight balanced native
pulses and sixteen trusted delivered edges. All ten commands, including capture
and normal quit, ACKed successfully; none was replayed.

The actual owner is WebGL2 on Intel UHD 620 / Mesa 23.2.1 through ANGLE,
endpoint 1. Guest target `D72E539365081156215BA2FF33E11ABB` and renderer target
`D8F8A926DDB404CFA9DF5497F544C071` retain full binding/module evidence. Requested
GPU flags were not used as owner proof. No software route was launched here.

## Retained producer transition and specific blocker

`transition-analysis.json` identifies the exact original records. In
`diagnostic-command-7.json.gz`, GPU order 21629 is an opaque scene submission
that changes the selected pixel from `[156,146,99,255]` to `[66,81,49,255]`.
Order 21637 is also opaque and leaves `[222,166,156,255]`.

Order **21645**, command sequence 6898 / ordinal 11, changes that pixel from
`[222,166,156,255]` to `[255,255,255,255]`. Its description and lowered state agree:
blend enabled, source/destination 2/2 (ONE/ONE), depth writes disabled. It is a
large textured triangle/quad submission, with the retained triangle spanning
approximately x=-209..785, y=-273..753. Texture entry 131812800, DIB 476147712,
has white native/decoded observation-time samples at the selected UV candidates.
This proves the selected destination-pixel transition at this natural submission;
it does not prove the texture's original asset or the earlier CPU texel writer.

Order **21660**, source sequence 6902 / ordinal 1, is subsequent scene geometry
using texture entry 131811840, depth writes enabled, but blend still enabled and
destination 2 in both description and lowered state. After a natural target
upload restores a nonwhite sample, this scene submission changes
`[99,60,0,255]` to `[214,130,57,255]`. Further sampled scene submissions retain
additive state; target uploads/readbacks subsequently carry white pixels.
Depth-only clears alone do not replace that color.

In the same command-7 CPU drain, all 269 public Device Execute returns are zero.
Existing kind-29 hooks retain nineteen restores each of ALPHABLENDENABLE=0,
ZWRITEENABLE=1 and DESTBLEND=1, interleaved with additive passes. Those restores
continue after white, unlike a simple permanently missing restore. The hook
records a changed value before its ordinary store; it is not a raw memory
readback after that store. CPU and GPU serials remain separate orders joined
only by natural command boundaries, not a universal event timeline.

The first specific unresolved seam is therefore **execute-state store → draw
snapshot enqueue → immutable replay state → `d3dim_gpu_describe`**. Raw state
bytes/addresses and snapshot ownership at these boundaries were not retained.
Neither the store's persistence nor the first corruption/mis-selection of the
snapshot is established. A blend/clear/texture workaround would outrun this
evidence. Next work should observe those exact state fields and immutable
snapshot identities at natural enqueue/replay boundaries before another fix.

There are 120 drains, 294,972 CPU rows and 5,950 GPU producer events. Startup
explicitly dropped 7,186 CPU rows (serials 32769..39954). Every later CPU drain
and every GPU producer drain reports zero drops; the sole CPU serial gap matches
that startup overflow. Thirteen earlier ground samplers reached their separate
32-record limit, including the initial gameplay-entry drain; all limits are
listed in `transition-analysis.json`. The combat transition drain has 30 ground
records, no record-limit stop, no CPU/GPU drops and no observation error. There
is no full causal claim across startup drops, earlier ground caps, unsampled
pixels, or the missing snapshot boundary. Pixel reads can synchronize the GPU;
this is not performance evidence.

## Recovery and lifecycle

All 255 remote output paths were downloaded twice independently and rehashed
locally. Module/frame hashes, full PNG structure, binding continuity, balanced
release and terminal records were checked. Large raw outputs were compressed
incrementally with exact round-trip hashes. The run kept its own evidence small;
shared disk approached the 1.5 GB floor and coordinator cleanup restored reserve.
No RAM gate was used.

Normal Browser.close completed. Chrome, its actual browser parent and the outer
API command exited zero, with separate stream EOFs. Unique evidence was verified
before delegated normal sandbox stop. Private box `bx_hbjcy258` had an observed
independent watchdog prearmed before allocation; initial expiry was
`2026-11-12T18:04:46.144Z`. Normal stop completed
`2026-11-12T16:12:43.493Z`, receipt `stop_988804c4ad07cd32`, forced=false,
error=null. Final state archived, expiry null. Lifecycle client, adopted owner
and watchdog have actual zero waits and EOF evidence. Do not resume/delete it.

No guest state/config/AI/health/position/clock writes, forced guest exports,
input replay, workers or public deployment were used. No full-27, parity, FPS,
audio, broad crash-freedom, enemy-defeat or level-completion claim is made.
