# Jedi observed-input attempt: host startup staging blocker

The encounter goal was not reached. The sole original launcher attempt exited
before a visible window or controller became ready because its staged runtime
omitted `tools/disasm.js`. This was this worker's staging error, not an observed
guest defect. **No Play click, movie, campaign, player sample, hostile
identification, shot or target effect occurred.** The first concrete blocker
ended the task; the launcher was not restarted.

Evidence is retained in gitignored
`scratch/runs/20261103-jedi-observed-input-encounter/`. The required
[timing findings](jedi-movement-duration-20261103.md),
[patrol attempt](jedi-patrol-facing-20261103.md) and
[measured route](jedi-live-sector-route-20261103.md) were read. The coordinator's
messageboard records its capTWO reread, reviewed fixture prerequisite and one
other live worker before dispatch. This worker launched no workers or subagents.

## Exact source and first failure

The fresh build used sealed committed main
`0d1d8e71d41172bc0f7ed7b56a3d521deabaf294`, including reviewed fixture
`444c9c17a`. All **5827** source inputs were streamed from Git blobs, excluding
foreign WIP, checked unchanged after build and independently reverified against
local Git for recovery. The source dictionary SHA256 is
`5605f8d9a96a41ab152a55f2bba4dbfe5f375d58c74d01d9e377b707babae32e`.
No repository runtime or fixture source was changed.

Fresh boat-side `flock /tmp/wine-build.lock bash tools/build.sh` passed.
The built module is **2088037 bytes**, SHA256
`1f39572325be5251c4b9a923e83d4ea9ff33962d4d3e7911a4835df20cf0ae7e`.
Actual compile-input and completed-instantiation receipts identify the sole
launcher **PID9940**, Node24.22.1, Linux x64, with that exact module.
There was no child or loaded JkDemo instance.

The supervisor launched at **2026-11-03T13:03:23.351090Z**, selecting
`--real-ticks`, guest limit1200s and outer limit1260s, with immutable recorded
outer deadline **2026-11-03T13:24:23.351108Z**. PID9940 exited1 after
**0.400921309 host seconds**. Its log reports
`Cannot find module '../tools/disasm'` from `test/run.js:6500`, before CLI
controller readiness. Two capture requests received connection refusal;
neither produced an image or player observation. No simulation duration is
inferred from this host interval.

The dependency exists in the sealed build inputs: Git blob
`e396cdf735b7b6786c3c65744f525c40c4b2e8d2`,29904 bytes, SHA256
`4d64e8b9b49a1901feb05df182a112f7f1eb4c5875a45d9f376172e8a2668166`.
It was absent from the actual runtime tree. The staging helper selected an
older retained runtime list after its intended historical metadata was found
missing. A preparation-only observer control first exposed a missing
`lib/process-desktop.js`; copying all sealed libraries resolved that control,
but did not validate the full CLI dependency closure. The later missing
`tools/disasm.js` stopped the actual launch. Passing focused tests did not
establish that the staged CLI could start.

## Integrity, controls and timing limits

Original restoration verified **28 installed files /39900850 bytes** and all
**361** historical tree mappings. Before/after disk checks preserve every
original, genuine DSOUND.VXD/DDHELP, staged runtime members and baseline76-entry
registry input. The actual preload verified all28 originals and the76-entry
registry before loading the launcher PE. Its log confirms import of76 entries;
the overlay is empty. No final in-memory registry export or child Version delta
was available because host startup failed. No config/asset patch, guest memory
write, cheat, fabricated save, skip, restart or second campaign was attempted.

Nine boat-side focused tests passed: shell CLI routing, WinExec readiness,
keyboard message lParam, process desktop, restored input clock-domain assertions
and five mutation rejections, guest-clock source, startup clock, batch clock,
and control-server step progress. Four no-guest observer controls passed after
the preparation staging correction. Four local synthetic controller checks
verified timed release, release after a down-request error, release before a
post-observation error, and rejection of steering on fresh damage. These are
control tests, not actual guest input delivery in this attempt. Known unrelated
input-state `missingmainSchedulerObserver` and source-only CLI trace
`DispatchMessageA` marker failures were not repaired or counted as passes.

The prepared read-only observer retained verified original Coords0x4eec10 code
identity and fresh global-to-player traversal. Original `gethealth` registration
and handler0x502820 establish actor+0x134. Original `getinv` and0x4d2270 establish
player+0x1c0, then+0x88+24*bin; freshly extracted original `items.dat` identifies
bin60 as shields and11 as energy. Original0x4dd8f0 establishes timer last-read,
clamped delta and simulation accumulator addresses. Disassembly and code hashes
are retained in `original-observation-basis.json`.

**None of these player/health/clock reads ran against a live game.** There are
no fresh pre/post encounter samples or personally reviewed screenshots to
supply. No timing, movement, damage source or scheduling conclusion follows.
The planned controller would record monotonic intent/release/observation,
take fresh state before steering, release through a controller-owned timer and
finally path, and observe post-release and neutral states. That plan remains
unvalidated in a campaign; it is not an encounter result.

## Recovery and lifecycle

Only fresh boat **bx_cst2sm25**, TTL7200, original expiry
**2026-11-03T15:00:10.233Z**, was used. Identity, expiry and delegated
shutdownOwner `jedi-observed-input-encounter` were recorded before use.
No predecessor boat, Chrome, public deployment, held/HeroesII/laptop lane or
foreign owned code was operated.

All **56** retrieved payloads passed byte-count and stored/original fullSHA
checks. The evidence archive is **2249380 bytes**, SHA256
`4d6e431f9f40bba3dc56c4e4212e0536da1c3344092882b964965419edcfa331`.
`RECOVERY.md`, original recovery inputs, sealed source, runtime manifest,
build/test logs, original disassembly, instance receipts and failure log remain
local. The recovery record was uploaded and independently retrieved byte-for-byte
before normal stop:3551 bytes, SHA256
`2f719dc870699cc46a8ab35d1c3cf8b530f830d00b7d42c596e418b57933c862`.
Scoped helpers and ports8143..8159 were verified absent.

Normal stop **stop_073b4a5f68dc1cd6** completed at
**2026-11-03T13:05:05.590Z**: **STOPPED/completed/error:null/forced:false**,
with normal snapshot available. The lifecycle sidecars retain that result.
A future separately authorized attempt should first verify a complete staged
CLI dependency closure without launching a guest. This finished task does not
repair staging or authorize another campaign.
