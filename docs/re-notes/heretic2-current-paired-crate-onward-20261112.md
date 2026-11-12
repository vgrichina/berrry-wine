# Heretic II current checkpoint load exits before traversal — 2026-11-12

Current WebGL reached original Game → Easy docks gameplay, but normal
`load crate0400` did not reach a completed saved world. The guest called
`ExitProcess(8)` while loading/resuming that world. The next passive capture
found no registered app and detached guest/renderer Workers. **Current paired
traversal, a living crate reload, and onward progress remain unqualified.**
SoftwareGL was not launched after the terminal failure. No new save was made.
This is a bounded checkpoint-load blocker, not an established emulator defect
or evidence of native gameplay death.

Run: `scratch/runs/20261112-heretic2-current-paired-crate-onward-1110/`.
Tested runtime source is published
`8a834a3dc7affc8c6e53245beab56e87a32b81e8`, with actual page, guest Worker
and owning renderer module SHA-256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Shared checkout entry was `54d1c903a`; later shared commits were not repinned.
Historical `30f9318e6` / `1165f15c…` SoftwareGL proof remains historical.

The Hexen II 1040 API envelope, persistent command ACK, retained CDP observation,
release, cleanup and readiness controls were reused with hash-identical core
helpers. This run adapted the registered identity to `heretic2_demo` and its
direct GL startup, rather than Hexen II's informational dialog. The native
Pause helper uses the previously established 800 ms physical press and
3,000 ms neutral interval; these are host intervals, not guest frame timing.
No native fixture rerun is claimed. Local adapter checks cover app/birth
selection, physical keys, exact save hashes and rejection of unauthorized
console strings.

The original registered media closure contains 1,826 files, including its
manifest. Local originals and provisioned bytes matched retained hashes.
An initial local adapter check caught an unsupported VFS mount method before
browser use. It was corrected to resident VFS entries plus `ensureParentDirs`.
The corrected manifest and helper closure were uploaded, every final pin
verified remotely, and the actual provisioning process joined successfully
**before** browser launch. Initial and final closure receipts are retained
separately; the final manifest has 2,425 pinned files.

Original Main → Game → Easy was selected with native keys. Passive waits
separately reviewed the loading map, docks introduction and full upright docks
world with HUD. Only then were all four exact files from retained
`20261112-heretic2-north-opening-health-crate-0400/save-inputs/crate0400/`
mounted at their manifest guest paths. Independent resident VFS readback
matched every size and SHA-256 before native console loading. No health,
resources, config, media or clock writes, forced guest calls or cheats occurred.

The native console visibly contained exact `load crate0400`; Enter executed
it once. `load-executed.png` records Loading game, server initialization,
Silverspring Docks and Map demodocks, over a black world with native Paused.
A separate Backquote press and native NumLock resume were reviewed individually.
`load-native-resume.png` remained black, so no gameplay input was admitted.
The subsequent command was a passive 15-second wait/capture.

`terminal-console.jsonl.gz` records `[ExitProcess] code: 8` at
11:17:45.248Z. `terminal-saved-assets-wait-state.json` records `apps: []`,
both Workers detached, and their recovered current module hashes. At
11:18:00.730Z capture identity validation failed with
`one isolated registered app required`; the exact command's persistent ACK
wait then reported runtime closed. That admission failure follows the guest
exit; it is not proof that the capture caused the exit. No pending action was
replayed. The final state lacks a completed saved-world screenshot or native
error text explaining exit code 8. The cause inside the game/runtime remains
unresolved; neither rendering parity nor a source regression is established.

The large crate's earned historical Flying Fist break and HEALTH POTION /
HELLORB pickups are preserved in retained 0400 evidence. Its absence was not
reverified here because the loaded world never completed. Keep whole
`crate0400` preferred, with whole living `tavern0237` and `key0136` fallbacks.
Do not substitute failed `guard0330`, `door0136`, `onward0435` or
`landing0435`. No health gain, enemy hit/kill, door opening, physical GPU,
FPS, audio, parity or full-corpus claim is made.

Recovery verified 155 remote references / 127 unique raw hashes, including
encoded and decompressed SHA-256/size, 12 capture bindings, all four retained
save inputs and 42 balanced trusted keyboard events. Run `check-evidence.py`
for those checks. `compressed-evidence-manifest.json` and
`retrieval-verified.json` map exact remote paths to local gzip blobs. Git plus
the recorded source commit, relevant diff and owned-helper patch recover
source; no source/media archive was made. No production edit or build was
needed for this evidence-only result.
`local-log-compression.json` records roundtrip-verified compression of the
local API/upload/terminal-console logs; their original names in commands refer
to the decompressed bytes.

Own box `bx_jswdbwfx` had initial expiry **12:04:59.286Z** and a prearmed
independent watchdog. Browser close returned 0; the runtime's actual parent
returned 1 with stdout/stderr EOF, preserving the capture failure. Unique
evidence was recovered and hash-verified before normal delegated stop.
`stop_2c4971330fbe58cd` completed nonforced, error null; the box is
**ARCHIVED at 11:19:15.304Z**, expiry null. Local manager and watchdog each
have actual successful joins and EOFs. Do not resume/delete the box by default.

Next: isolate the current crate0400 load exit using the preserved exact input
and module identities, with backend comparison and native load-error evidence.
Only a completed upright world plus fresh movement and released survival can
close this checkpoint gap; then seek the lower-stair save or changed defensive
approach before the north-room enemy.
