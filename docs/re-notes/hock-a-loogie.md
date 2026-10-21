# Hock-A-Loogie: original package and runtime evidence

Current status (2026-10-21): bounded original-game startup, input and visible
0/20 → 5/20 scoring evidence is accepted on the explicit-EXE route, integrated
at `2e2c363e8`. Candidate registration reconciliation is preserved on
`task/hock-registration-reconcile-oct21`, **not integrated**: the existing corpus
runner rejects main's unrelated Baldur's Gate package pin before selecting
Hock. See the [registration review](../reviews/hock-registration-reconcile-20261021.md).
No app-selector or registered-route runtime qualification is claimed.

## Historical startup placement repair (2026-10-21)

The original BBLOOGIE.EXE now leaves its startup sizing loop and displays the
"Choose Beavis or Butt-head to start" screen. This is a bounded startup repair;
input, gameplay and audio are untested. Independent review is required before
integration. No main merge or public deployment was performed by that task.

## Cause and repair

First checked trace semantics on exact main
`7e5cf3535946e0a7bf42179b728a8471dc9f6b67`: `test/run.js` formats call arguments
inside `h.log` before dispatch, but formats `out:` parameters inside
`h.log_api_exit` afterward. Entry-time pointer contents are not return values.
The baseline's **out** records really show an outer rectangle `(358,0,358,480)`
with client size 632×434. This was a feedback-loop consequence, not evidence
that GetWindowRect itself wrote the wrong rectangle.

The guest sizing function at `0x004067d0` computes non-client extents from
GetWindowRect minus GetClientRect, scales its desired dimensions to the screen,
calls SetWindowPlacement, and compares the resulting client dimensions at
`0x00406919`. Mismatch branches at `0x00406921` / `0x0040692b` return to
`0x0040681a`. Source and disassembly evidence are sealed with the run.

`$handle_SetWindowPlacement` moved the host's outer rectangle but omitted the
CLIENT_RECT refresh used by SetWindowPos. `get_window_client_size` in
`lib/host-window.js` prefers WAT's initialized client rectangle, so the guest
continued to see 632×434 while its outer width shrank. The renderer's own
client computation also preferred that stale WAT record.

Ten added lines in `src/09a5b-handlers-window-late.wat` recalculate the standard
non-client geometry **after** the host move and synchronize the host client
rectangle before the existing show-state path. The repair uses existing
helpers, introduces no callbacks, and preserves existing show-state handling.
No game-specific condition, output, API stub or asset change is involved.

## Verification

- New `test/test-window-placement-client.js` runs the real source-compiled WAT
  handler and renderer imports without a game binary. It checks 15 growth,
  shrink, move-only, repeat and client-size convergence cases across visible
  captioned, visible borderless and initially hidden windows, including stdcall
  cleanup and renderer client origin/extent.
- Exact-main baseline fails: client 392×272 rather than 500×348 after resize.
  Candidate passes. Moving recalculation before the host move fails the same
  assertion; deleting host synchronization fails the renderer-mirror assertion.
  Both controls exit 1 with AssertionError, and candidate source is restored.
- Existing child first-show, secondary top-level first-show and ShowWindowAsync
  tests pass. Owner gate verifies 267 owners; callback census verifies all 401
  boundaries unchanged. Fragment, A/W and test-tier gates pass, without refresh.
- Canonical remote `bash tools/build.sh` passes all gates, Boat
  `cmd_uydlnnqxmerz`. Heavy compilations and runtime tests were remote only.
- Original 39-file assets verified. Candidate diagnostic
  `cmd_exlluiryqq9s` shows two SetWindowPlacement calls; returned client width
  changes 632 → 561 → 556, then guest advances beyond the loop. Outer rect
  settles at `(38,0,602,480)`. Five-second/250-batch and 30-second captures have
  identical SHA256 `98f22f8f8e19a6c2cbece7092db349e0618513c070bebb5ea758debca839e649`.
- The 30-second run `cmd_vdlyav4tmyy9` completes 3315 batches / 75,746 API calls;
  baseline had 138,161 batches / 86,305,741 calls and remained solid teal.
  Both baseline and candidate screenshots were actually inspected. Candidate
  shows title/menu chrome and the start screen; the right character is partly
  clipped, so this does not establish complete rendering or playability.

The existing missing-comctl32.dll warning remains; neither run trapped on a
missing ordinal. It is not the cause of this placement loop. No unrelated fix
was attempted. An initial full-file upload hit the local argv-size limit and
never reached Boat; its prematurely labeled candidate test reran baseline and
failed. The subsequent patch upload and source/module seals distinguish the
actual passing candidate. Local and remote patch text differs only in Git's
object-ID abbreviation length, independently normalized and verified.

## Identity and handoff

Accepted baseline source tree: `934a1ecde8ab26582e5dfc0b911f2ea2dc96adae`.
Candidate differs in one tracked source file plus the new regression test;
all 7,132 baseline tracked-file hashes were compared. Reports are not compiled.

| Artifact | SHA256 |
|---|---|
| Baseline canonical WASM | `7ebd28d0ee057c6aec01be9775b456726113083f2e76a4dd9767bb93e2a0b2bd` |
| Candidate canonical WASM (1,878,114 bytes) | `eafeaa142c98fe60c489865c89a676c20afffe51002fe36799f42aa46d19ac2c` |
| Candidate compat WASM | `f5ade4a49be77b9976fb3542d9a9d39ca1ffe9614346affddd8098d70e1c3ca9` |
| Candidate changed source file | `8ea5110a9b36749a6dadc3ae0fbf8f205e2e55efcf93fad39d39ebac3097a8d0` |
| Original EXE | `974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4` |
| Original archive | `e10d150131258641af11609249ac7f1c430e67e4138943d175b0365ba64be00b` |

Run: `scratch/runs/20261021-hock-placement-loop-repair` (receipt, result,
RECOVERY.md, command receipts, complete source/package seals, logs, captures).
Compact committed evidence:
[`../reviews/hock-placement-loop-repair-20261021-evidence.tgz`](../reviews/hock-placement-loop-repair-20261021-evidence.tgz).
Baseline evidence remains in `20261021-hock-accepted-canonical-runtime`, published
as `d71f4ca951b40be17e060c0d36afeb062265839d` on
`task/hock-accepted-canonical-runtime-oct21`.

SAME running Boat `bx_3f3x23m3`, TTL 05:56:19.894Z, Node v24.18.1 / CLI fullVM /
JS raster canvas. Baseline root `/home/user/hock-accepted-canonical-runtime`
is untouched. Candidate root `/home/user/hock-placement-loop-repair` retains
repo, dependencies, modules, logs, mutation driver and recovery seals. Coordinator
alone owns lifecycle; no stop/snapshot/resume/fork/create/delete was issued.
Task branch: `task/hock-placement-loop-repair-oct21`. No workers were spawned.

## Original scoring evidence (2026-10-21)

The later qualified module on source `776d37d5` (identical production inputs
to integrated `d2034ccf`) accepts real left-mouse charge/release input and shows
score **0/20 → 5/20**. See the [scoring runtime report](../reviews/hock-scoring-runtime-20261021.md)
for the two bounded routes, screenshots, seals and recovery. `0x401c20` starts
the charge; `0x402ce9`–`0x402d21` holds/releases it, capped at 61 logical ticks;
`0x403060` uses charge for projectile travel. Read-only score cell is `0x41a030`.
The package lacks the EXE's named `..\Bbgame.hlp`. Exact struck target and
collision instant, completion, sound quality, FPS and Windows parity remain
unqualified. No guest bytes/state or production source were changed.

## Original candidate package contract (2026-10-21)

The proposed `hock-a-loogie-1995` candidate recipe is local-only proprietary
Viacom New Media material; it grants no redistribution or public deployment.
Source is the archival wrapper at
`https://archive.org/download/Hock-A-Loogie-1995/beavislg.zip`, not an
authenticated publisher master. Version resources say 1.00, fixed 1.0.1.0,
internal/original `bbmini.exe`; distributed executable is `BBLOOGIE.EXE`.

Retained intake: `scratch/runs/20261020-hock-loogie-original-intake-oct20/`.
Its `SHA256SUMS` digest is
`31230f2aa354498853120b39417e1385d5f218e623bdf15e4493b49b9db9dfa7`.
Outer archive: 1,256,578 bytes, SHA-256
`e10d150131258641af11609249ac7f1c430e67e4138943d175b0365ba64be00b`,
SHA-1 `68be591b75813f81409314ad1944d64927835be5`.
Extract to `distribution`, then extract `distribution/BEAVISLG.ZIP`
(1,254,275 bytes, SHA-256
`24da14e65b7a5418f9f4099a8ec6dcf6998004c350f365936b8d9ef0b6a3f05e`)
to `game`. Outer survey HTML/text are not game assets.

The original package has 39 files / 2,224,918 bytes: EXE, `BBLOOGIE.000`,
`SOS9502.DLL` and 36 AIFs. Every name/size/SHA-256 is pinned in
`test/test-hock-a-loogie-local-registration.js`. EXE SHA-256 is
`974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`;
SOS9502.DLL SHA-256 is
`a706691cd04bc66fd290977fc5a863b99c004e06f8980b6fc8a04d2bc4f26b7e`.
The candidate fixture root is `test/binaries/candidates/hock-a-loogie-1995/`.
CLI `vfsInclude: ["**/*"]` resolves all files beside `game/BBLOOGIE.EXE`;
the runner roots relative paths at `C:\`. Browser inventory excludes the
separately loaded EXE and maps all 38 companions to `c:\<filename>`.
No registry seeds or DLL substitutions. No durable fixture installation.

PE32 i386 GUI, image base `0x400000`, entry RVA `0x1366f`, subsystem 4.0.
Imports include COMCTL32 ordinal 6; the supplied SOS DLL uses waveOut,
multimedia timers, MIDI and threading. Strings naming absent `sos32s02.dll`
and `DISPDIB.DLL` do not justify substitutions. Registry strings
`Software\ViacomNewMedia\BeavisAndButthead` and `LoogieHiScore` do not
establish a preseed requirement or persistence acceptance.

Run the registration regression with the retained intake (no build/runtime):

```sh
node test/test-hock-a-loogie-local-registration.js --intake=/home/user/wine-assembly/scratch/runs/20261020-hock-loogie-original-intake-oct20
```

Without the intake option only metadata checks run and package checks explicitly
skip. The registration review records actual fetcher/planner/VFS checks and the
unrelated corpus-runner blocker. Historical runtime/publication holds in saved
candidate `86ffa207` are superseded; this task has no runtime allocation.
Accepted startup/input/scoring evidence above is from an explicit-EXE route,
not this registry recipe. Completion, persistence, audio quality, FPS, Windows
parity and registered/browser route runtime acceptance remain unqualified.
