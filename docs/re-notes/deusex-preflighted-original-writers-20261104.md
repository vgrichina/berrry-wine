# Deus Ex: original natural Draw, missing upstream writer provenance

**One original game launch completed a natural Draw return sequence. The captured
client and surface are black. Descriptor, overlapping-writer and allocation/free
provenance remain missing.** No gameplay or allocation-lifetime claim follows.

This uses published [complete driver input preflight](deusex-complete-driver-input-preflight-20261104.md)
at `c5f85d55f`, without changing its driver or pins. Evidence is in
`scratch/runs/20261104-deusex-preflighted-original-writers/`. No production code
changed, no repair was justified, and no full-build claim is made.

## Exact preparation and controls

The staging plan matched SHA-256
`574c8ac716e016f1885a16dbb270d0c8cf1b5d6573183f577b470076176ae173`:
**25 explicit small uploads, 1,232,263 bytes, and 462 existing-only references**.
All 487 destination files matched exact size and SHA-256; two are manifests,
leaving **485 actual input pins and 251 derived requirements**. The independent
native companion requirement passed: `native-paths.json`, 1,171 bytes,
`7c37fb7cc2321763d157a237c5ea12330291421d015dc36fdee16efb3679fc8a`.
No differing file was repinned. Modules and game media stayed at existing paths.
The predecessor's frozen staging plan was verified and transferred directly;
its local files were not regenerated or edited.

`recovered/supervisor/control-terminal.json` preserves twelve successful commands,
each command/hash, helper hash, exit code, elapsed time and separate log. The
first actual dependency check preceded helper import, server and browser. Real
Puppeteer **25.7.0** CJS/ESM imports and executable `/usr/bin/google-chrome` passed.
The eight prior controls ran fresh: composition, cache graph/self-test,
integration `a7e61017…`, queued transport `b201cb17…`, optional/pixel `1be33be0…`,
archived replay `fdb1acd8…`, composed actual `afdf1f5f…`, and actual HTTP/import
qualification. The current HTTP graph verified **162** inputs, without assuming
the historical 157. These fixture controls are separate from natural evidence.

The final actual dependency check and served checks ran again immediately before
the sole driver invocation. Both module responses had exact length/SHA-256,
COOP `same-origin`, COEP `require-corp` and `Cache-Control: no-store`:

- Original `build/wine-assembly.wasm`: 2,146,525 bytes,
  `4ddc8336097ef4b8503c6e6d2bb7fb05a2a1084800322523c8959b7128ca217a`.
- Companion `build/wine-assembly.compat.wasm`: 2,149,138 bytes,
  `d4c5171a2865a1dbc360d53e3a32fbfa2149e1bcdabaf57ee6dad4bd9338a367`.

The prepared actual driver remained 9,560 bytes,
`fcfe9b91543e28046fe098b703458ea820471d6757e9280881224b0c6753bb21`.
The installed adapter reported
`c33adc61c76406e896e9a0cb2dc373fdffd4c3c330ed758121bc48a63b017092`.
`source-provenance.json`, the relevant binary diff and owned-new-file patches
record source recovery. The remote retained runtime has no `.git`; its identity
is established by exact pinned bytes and predecessor reconstruction records,
not by claiming the local orchestration HEAD was its checkout HEAD. No source
archive was made. Initial Boat SSH access returned 403 `api_key_action_forbidden`;
the predecessor's documented API exec/signed-file transport worked. This access
attempt and exit code are retained; there was no runtime-control failure.

## Natural launch and measured limits

Coordinator allocation was recorded before launch: fresh **bx_6wk3nvmd**, fork of
stopped bx_g8gbdt7c; expiry **13:20:22.474Z**, guest/Chrome cutoff **13:08Z**,
recovery **13:13Z**, coordinator normal stop **13:16Z**, all on 2026-11-04.
`DEUSEX_CLOSE_AT=2026-11-04T13:08:00Z` was explicit. The full unchanged eight-minute
maximum plus five-minute recovery reserve fit at admission. The driver selected
its earlier relative bound, **12:51:35.578Z**. This was an available maximum;
the existing natural completion predicate ended the session earlier.

One supervisor PID **9264**, driver **9280**, and Chrome **9288** ran.
Chrome **151.0.7922.108** launched **12:43:36.296Z** and closed
**12:44:21.518Z**; supervisor returned **0** at **12:44:21.564Z**.
The measured loaded executable was
`test/binaries/candidates/deus-ex-demo/installed/system/deusex.exe`.
Readiness met at **12:43:50.429Z**: native `GIsRunning=1`, isolated/threaded owning
Worker and a visible source-bearing window. There was no retry, reload, second
Chrome, guest call/write, forced Draw/repaint, fault clearing or configuration fix.

The natural collector reached entry, lockCall, lock, unlockCall, unlock, tailCall,
tail, epilogue and savedCaller, each once, with 128 render-ESP save/restore pairs.
It terminated after **27,819.355 ms / 781,008 charged blocks**, using the unchanged
**120,000 ms / 10,000,000 block** limits. Its exact terminal status was
`render-route-return-candidate-unverified-lifetime`, at saved caller
`0x1134426e`, owning thread 1 / Worker slot 0. Engine `0x103ef0a0`, viewport
`0x19309380`, entry ESP `0x179ff878` identify this observed frame. Reciprocal
object membership at boundaries still does not prove lifetime.

## First missing provenance

The ordered observer ended at its existing **10-second** cap. It delivered
**230,874 boundaries**, decoded **27,556 stores**, found **zero overlapping
stores**, and counted **203,318 unrecognized instructions**. No record or pending
drop occurred. There are **227 natural consumers and one palette selection**,
with **no descriptor or overlapping-writer record**. Every consumer's descriptor
is null. Palette generation 1 records a pointer observation, not allocation.
The first consumer reads texel 1 at `271384456`, palette entry `412029088`
(eight zero bytes), zero light bytes at `290296568`, shift 32 and mask zero.
The SoftDrv module identity includes SHA-256
`25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18`.

The producer retained **16 paired pixel samples**, zero unpaired/unexpected-next
samples, and 217 capped sample omissions. All sixteen after-store samples are
zero 16-bit values. Producer errors are empty. Six raw buffers were saved before
PNG capture; the actual 640×480, 16-bit buffer is **614,400 zero bytes**, SHA-256
`34c69899504b36f13e8b22120cf0fd894e61fcd6b046fb8535b79cc491fa3b3f`.
Personal inspection of both `fresh-host.png` and `fresh-surface.png` confirms
black game content. This does not establish a menu, playable frame or causal
pixel defect. Surface publication events do not resolve the full viewport-to-host
binding, which remains unknown.

The first concrete prerequisite is **a natural descriptor and instruction-level
overlapping writer, with allocation/free identity, before consumption**.
The present observer starts after readiness, covers delivered boundaries only,
has a ten-second bound, and explicitly admits interior-block writer gaps.
Zero observed overlap cannot establish absence of a writer. The next scoped work
is offline analysis of this exact trace and observer attachment/decoder coverage,
then a separately allocated natural run with a tested observation plan that can
capture upstream allocation/descriptor/store history. No speculative emulator,
palette or pixel fix is supported by this evidence.

## Recovery and custody

All **376** remote files (**17,432,477 bytes**) were recovered or matched to exact
retained small inputs; every size/SHA-256 passed and a second inventory was
identical. This includes closed Chrome profile data and the queued transport's
result from its original helper directory. `evidence-inspection.log` records
focused checks of natural checkpoint identity, terminal bounds, consumer identity,
six raw hashes and paired samples; these are evidence checks, not offline gameplay.
The note passes `git diff --check`. The repository run-evidence checker has no
finding for this run; its overall exit 1 retains 16 errors in other runs.

At **12:45:08.374Z**, all own control/supervisor/driver/Chrome PIDs were absent,
Chrome inventory was empty, and port 8123 was closed. Box **bx_6wk3nvmd** was left
**RUNNING** (API `idle`, healthy/hydrated), expiry **13:20:22.474Z**.
Custody return was appended at **12:46:04Z**. Coordinator owns shutdown; this
worker performed no stop/resume/delete and ends after this explicit-path
publication. No further box access follows handoff.
