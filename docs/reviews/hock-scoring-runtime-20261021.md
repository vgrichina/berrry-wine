# Hock-A-Loogie original-game scoring: 2026-10-21

**PASS, bounded scoring evidence:** unmodified original BBLOOGIE.EXE accepted
mouse charge/release input and increased the visible score from **0/20 to 5/20**.
Two targeted runs were used; no third run, production fix, rebuild, main merge,
new game, deployment or worker assignment was performed. This is not completion,
audio, FPS or Windows-parity qualification.

## Evidence and observed behavior

The sealed companion `hock-scoring-runtime-20261021-evidence.tgz` contains the
exact drivers, commands, wall-clock input timings, complete logs, PNGs and
source/package identities. Extract it and verify `SHA256SUMS.json` and the nested
`runtime/SHA256SUMS.json` before review. The runtime archive's 53 seals were
checked after download. No game memory, bytes or state were edited; the only
guest-memory operations were two read-only diagnostic dumps per run.

| Run | Real input | Actual result |
|---|---|---|
| run1, 58.274 s | Select left character with a 250 ms click; 15 left-button holds at canvas (320,250), cycling 150/300/450/650/900 ms, 2.8 s apart | Visible projectiles, but score remained 0/20; after capture timer 76. All 54 input/capture commands acknowledged; exit 0 at the wall-clock limit. |
| run2, 72.274 s | Same selection; 36 holds at (308,250), cycling 650/800/950 ms, 1.55 s apart | Score 0/20 at timer 116, still 0/20 at timer 67, then **5/20 at timer 61** and final timer 59. All 135 commands acknowledged; exit 0 at the wall-clock limit. |

The decisive inspected screenshots are `runtime/run2/shot-02.png` (0/20),
`runtime/run2/shot-34.png` (0/20), `runtime/run2/after.png` (5/20) and
`runtime/run2/final.png` (5/20). `runtime/run2/shot-20.png` also shows a projectile
and moving targets while the score is still zero. The opening `before.png`
briefly shows the original next-level banner with a 0/0 denominator; the later
gameplay captures above establish the 0/20 → 5/20 comparison.

Input acknowledgments alone are not the acceptance evidence. The visible score
increase is. A read-only dump at 69 seconds independently reads score 5 at
guest address `0x41a030`, versus 0 in the 8.1-second dump. The earlier shot-34
capture is at about 63.8 seconds; the 69-second dump brackets the observed
increase. The exact collision instant and identity of the struck target are
not established by these spaced screenshots. No additional hit count, target
type, level advance or completion is claimed.

## Original control behavior used to choose the route

The preserved original package has no `Bbgame.hlp`; the executable's Help action
names `..\Bbgame.hlp`. Its Unicode resources supply Help/Contents and the game
menus, but no control instructions. Inspection therefore used the original
EXE's code, not an invented game rule or an alteration of its state.

At `0x40445a` and `0x404475`, the game polls GetAsyncKeyState for left/right
mouse buttons and converts their held bits into flags 4/8. The active-game
handler `0x401c20` uses horizontal pointer position and starts a charged shot
when the player is ready. At `0x402ce9`–`0x402d21`, continued holding increments
the charge up to 61 logical ticks; release or the charge limit leaves that
state. Charges below 30 and charges of at least 30 use different animation and
projectile-creation paths. Projectile update `0x403060` uses the remaining
charge and the original table at `0x444210` to determine vertical travel.
These observations motivated shorter holds first, then denser 650–950 ms
charges aimed centrally. They do not establish a universal wall-clock timing
recipe across hosts. Relevant disassembly receipts are in `inspection/`.

## Exact identity and environment

- Integrated main independently checked: `d2034ccf750f2482fa78012b30039800e75b9f54`.
  Its 5,017 non-documentation inputs match the integration identity receipt.
- Runtime checkout: `776d37d55d2f749dcb29203e3bd26b8a5e9c05bd`, tree
  `2f9a39909708b323973fee6f6052433b82e6baa7`. All 7,146 tracked files matched
  their Git blobs and the sealed source manifest before and after both runs;
  runtime Git status remained clean.
- Canonical module SHA256:
  `728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`.
- Compat module SHA256:
  `25519647def1c2a25f505a81743d21dec55472ede8780f809edf09b6bb231018`.
- Source-manifest SHA256:
  `9918eef5f9b441693bf39f425ab988af7f5883971c451ddea53796bddae07a76`.
- All 44 package/recovery seals checked; 39 original game files, 2,224,918 bytes.
  EXE SHA256 `974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`.
  Original archive SHA256
  `e10d150131258641af11609249ac7f1c430e67e4138943d175b0365ba64be00b`.
- Assigned Boat `bx_c6f3np32`, Node v24.18.1, CLI full VM with JS raster renderer,
  640×480 canvas, real guest clock, existing canonical module via `--no-build`.

The prior all-gates qualification is reused only after identity verification.
No new build qualification is implied by these gameplay runs.

## Preservation, recovery and remaining limits

The final runtime archive was preserved locally at 06:43:06 UTC, before the
08:05 deadline: 4,776,090 bytes, SHA256
`ba9d1dc27096bce1299cae82b36b9191456830c1a5f7d7364f8c306cfe9f7422`.
Shared-host free space temporarily fell below the required 2,285,895,680-byte
floor. Both bulk-write guards refused allocation; the eventual transfer
buffered data in memory and waited for at least 24 MiB above the floor before
writing/extracting. Task allocation remained below 64 MiB. No unrelated files
were removed to make room.

`RECOVERY.md` in the evidence explains replay with the preserved original
package and qualified module. Runtime raw files remain in
`/home/user/hock-scoring-runtime`; the existing source/modules/intake remain in
`/home/user/hock-final-size-canonical-runtime`. The SAME box is left RUNNING,
API idle/health ok, expiry **2026-10-21 08:14:54.696 UTC**. Coordinator owns
shutdown. No stop/delete/resume/fork/create operation was issued.

The remaining narrow diagnostic, only if exact collision attribution is needed,
is a denser screenshot sequence during the last roughly six seconds of run2,
with the same genuine input. Scoring itself is demonstrated; further work on
completion, sound, performance or Windows parity is outside this task.
