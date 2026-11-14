# Original Airstrike combat / native Quit — 2026-11-14

**Blocked before runtime: the registered original game closure is absent.**
The current `airstrike_pre6a` registration points to
`test/binaries/candidates/airstrike-pre6a/game/airstrike-pre6a.exe` and the
adjacent `.wine-assembly-browser.json`. Neither the fixture directory nor its
manifest exists. All **89 pinned game/provider files (4,072,418 bytes)** are
missing at the registered paths, including the original EXE, `airstrikerc`,
data, and eight authentic DLL providers. The production identity verifier
fails with `ENOENT` on the fixture's `game` directory. This is a prerequisite
failure, with no demonstrated input or rendering defect.

Evidence is in `scratch/runs/20261114-airstrike-combat-quit/`:
`result.json`, `closure.json`, `registered-verify.log`, `archive-search.json`,
`loose-search.txt`, `donors.json`, and `registration-test.log`. The inventory's
SHA-256 matches the registry pin
`e7e62dd423c604effd0f747ea3f3c63ff445ee698b0755b52312b077ea481d75`.
`source-pins.json` records inspected HEAD
`8b4b7f3b556f400a12464d0afe9d361e1aed7b84`, current source/module hashes, and
the explicit fact that no runtime executed. Relevant foreign uncommitted
runtime changes are preserved as `relevant-dirty.patch` and
`relevant-new.patch`; they were neither edited nor adopted. Git remains the
source archive. No module dump, media copy, source archive, or screenshot was
created.

The bounded read-only recovery search covered `/home/user`, `/tmp`, `/opt`,
`/mnt`, `/var/tmp`, and `/srv`. It found no loose original EXE/config/release
archive under their documented filenames. All 287 retained ZIP/tar archive
inventories examined in those roots contained no member with basename
`airstrike-pre6a.exe`, `airstrikerc`, or `airstrike.c`; none failed inspection.
No archives were extracted. This checks direct members, not recursively
nested archives or differently named opaque backups. The four documented
original/zlib/runtime donor directories in `donors.json` are absent. No
network acquisition, alternate game/provider, box, or inherited box attachment
was used.

Read the sustained-play, dispatched-Space, original recovery, local
registration, and focus/menu-controller notes. Their controls describe comma
for acceleration, arrows for turning, period for firing, and Escape for the
native menu. Those historical source observations are **not a fresh read of
the original config/source**: those inputs were unavailable in this checkout.
The historical 115-second timeout remains insufficient native Quit evidence,
and historical ACKs do not establish current SDL consumption or combat.

Validation: `node tools/verify-airstrike-pre6a.js
test/binaries/candidates/airstrike-pre6a` failed with the recorded `ENOENT`.
`node test/test-airstrike-pre6a-local-registration.js` passed its static
local-only registration checks and explicitly **skipped retained-input
acceptance** because original inputs were not supplied. The read-only
preflight completed normally, with 89 missing files and zero matching
archives. No guest, Wasm instantiation, Worker, input controller, build, or
heavy-runtime lock acquisition occurred. This documentation-only change does
not require the code-commit full-build gate. No gameplay PNG exists to review;
movement, projectile emission, combat consequence, and normal Quit are all
unproven.

Resume condition: restore the exact 89-file original fixture and its 88
companion mappings from an existing authentic source, verify the complete
pins with `tools/verify-airstrike-pre6a.js`, then perform fresh startup/menu
review before finite frame-bound ordinary controls. No download is authorized
by this report. Subsequent runtime still needs prearmed independent releases,
postrelease progress, actual visible combat, fresh native Quit selection, and
guest exit rather than timeout. This single task stops at the missing-input
blocker; no speculative production repair is justified.

Box ID: none. State: `NOT_CREATED`. Expiry: not applicable. Stop receipt: not
applicable; no box or guest process was created and no runtime remains.
