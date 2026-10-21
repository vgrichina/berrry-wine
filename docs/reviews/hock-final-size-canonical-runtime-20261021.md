# Final SIZE canonical runtime qualification: PASS (bounded scope)

Exact candidate `776d37d55d2f749dcb29203e3bd26b8a5e9c05bd` passes the fresh
canonical all-gates build, independent original five-stage destruction repro,
maintained actual-guest tests and intended rejecting controls. The unchanged
original Hock held-input route retains the full HUD, advancing clock and player
input response. This is runtime qualification of that scope, not automatic
merge authority or full game/Windows-parity acceptance. No production source,
gates, main, public deployment or unrelated work was changed.

Source-delta acceptance was independently recorded in
`f6287affd5ac8b6ddea3dd730bfe09cfc2ea942d`. This run supplies the previously
missing fresh build and actual guest evidence; it does not reuse its source-slice
model as guest qualification.

## Identity and staging

Assigned fresh runtime `bx_c6f3np32`, Node `v24.18.1`, git `2.43.0`;
candidate checkout `/home/user/hock-final-size-canonical-runtime/repo`.
HTTPS shallow clone of `task/hock-final-size-lifetime-fix-oct21` followed by
normal `npm ci` succeeded. HEAD is the exact candidate, tree
`2f9a39909708b323973fee6f6052433b82e6baa7`. All 7,146 tracked files were compared
byte-for-byte against runtime Git blobs. An independent local object-store
walk produced the identical SHA256 manifest:
`9918eef5f9b441693bf39f425ab988af7f5883971c451ddea53796bddae07a76`.
Runtime tracked status was clean before build, after tests and after gameplay.
No module existed before the build.

The existing sealed recovery recipe fetched the original archive directly to
the runtime, without alternate hosts or local bulk assets. All 44 package
manifest entries, including provenance, match. The 39 game files total
2,224,918 bytes. Archive `beavislg.zip`: 1,256,578 bytes, SHA256
`e10d150131258641af11609249ac7f1c430e67e4138943d175b0365ba64be00b`.
`BBLOOGIE.EXE`: 223,744 bytes, SHA256
`974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`.
Original intake: https://archive.org/details/Hock-A-Loogie-1995.

The missing ignored `test/binaries/calc.exe` fixture was populated with an
unchanged copy of that sealed BBLOOGIE.EXE, as authorized. This is a PE loader
fixture for thunk initialization, not an altered program or source edit.
Placement tests use `PLACEMENT_FIXTURE` pointing to the original intake.

## Build and actual guest tests

From the exact candidate checkout, `bash tools/build.sh` exited 0, Boat command
`cmd_xlznfbqqt5xm`, 06:18:01.245–06:18:38.660 UTC. Every required gate ran,
including census, manifests, region gates and all shake modes, compiler
provenance, layout freezes, canonical WATX compilation and data-segment overlap
checks. Full output is `remote-evidence/canonical-build.log`. The harmless
terminal-clear message `TERM environment variable not set` is retained in the
receipt; the command exited 0 with no skipped gate.

| Fresh module | Bytes | SHA256 |
| --- | ---: | --- |
| wine-assembly.wasm | 1,878,508 | `728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c` |
| wine-assembly.compat.wasm | 1,881,081 | `25519647def1c2a25f505a81743d21dec55472ede8780f809edf09b6bb231018` |

These hashes remained unchanged after guest controls and gameplay. Compat was
built and hashed; gameplay used canonical. Individual maintained tests compile
the complete candidate source closure with their existing test exports through
the canonical compiler, execute actual x86 CALL/RET and callback paths, and do
not use the earlier source-slice model. Negative controls apply only their
existing in-memory test mutations, never production files or the shipped module.

Commands ran serially in the replay plan's order; `remote-evidence/tests.json`
records each exact argv/environment, start time and exit. Boat's enclosing
`guest-tests.json` receipt and every individual log are preserved.

| Command (under candidate repo) | Exit / evidence |
| --- | --- |
| `node tools/callback-ownership-census.js` | 0; 401 boundaries unchanged |
| `node test/test-callback-ownership-census.js` | 0 |
| `node ../independent-final-size.js` | 0; all five destruction stages |
| `PLACEMENT_GROUP=final-size node test/test-window-placement-notify.js` | 0; sixteen final SIZE cases |
| `PLACEMENT_GROUP=show-return node test/test-window-placement-notify.js` | 0; four return controls, ten destruction cases |
| `node test/test-window-placement-notify.js` | 0; complete maintained suite |
| `node test/test-thread-thunk-sync.js` | 0; continuation sync and same-slice publication |
| `node test/test-window-placement-client.js` | 0 |
| `node test/test-showwindow-child-size.js` | 0 |
| `node test/test-showwindow-secondary-top-size.js` | 0 |
| `node test/test-show-window-async.js` | 0 |
| `node test/test-startup-info-boundaries.js` | 0 |
| `PLACEMENT_GROUP=show-return PLACEMENT_CONTROL=zero-destruction node test/test-window-placement-notify.js` | intended 1: entry visibility, actual 0 vs expected 1 |
| `PLACEMENT_GROUP=final-size PLACEMENT_CONTROL=keep-success node test/test-window-placement-notify.js` | intended 1: placement final SIZE result, actual 1 vs expected 0 |

The original independent repro SHA256 is
`4a82983abc0e1316f4580308528d07cf946b0eefaf07382c1638a15acc37eae1`.
Only its three absolute require prefixes were adapted. ACTIVATEAPP, ACTIVATE,
SETFOCUS, MOVE and final SIZE destruction each returned zero, had a dead target,
and restored ESP/EBX/ESI/EDI and zero WINDOWPOS depth. It consumes CHANGED, so
an earlier derived SIZE cannot substitute for the final callback. Maintained
tests additionally exercise final SIZE ShowWindow/placement/implicit creation,
nested cases and destruction, and the actual loader/thread thunk sync includes
distinct CACA0031 and CACA003D addresses. The controls rejected on the intended
assertions, not setup errors.

## Original route and visual inspection

`python3 /home/user/hock-final-size-canonical-runtime/drive-candidate.py`
ran the archived driver with only checkout, canonical module, intake and new
output directory paths changed. Local validation proves that exact adaptation.
Its original event sequence, real ticks, 45-second guard, one-million-batch
limit, C:\\BBLOOGIE.EXE guest path, C:\\ cwd, all-file VFS inclusion and input
tracing were retained. No injected SIZE, asset patch, memory intervention or
alternate gameplay route was used. It exited 0 after 45.277496 seconds.
All 19 control events were acknowledged, and all nine mouse move/down/up
messages reached guest DispatchMessageA. The exact command, timestamps and
log are in `remote-evidence/original-held/`.

All eight PNGs were inspected, plus prior original-route selected/final captures
for comparison. The full score and timer remain visible at the top of the
playfield; the client is 556x434 at (42,42), inside a 564x480 window at (38,0),
on a 640x480 canvas. The title/menu and playfield bounds match the prior route;
there is no top-of-client cropping. Moving sprites sometimes overlap the timer
area, also visible in the prior original-route capture; this is not claimed as
Windows-parity-correct composition. The clock reads 120 after selection, 112
at 18 seconds, 100 at 30, 91 at 40 and 86 at the final capture. Selection enters
play, and the player visibly follows left → center → right. Moving targets and
projectiles are visible. Score remains 0/20: successful hits/scoring and game
completion are unqualified.

Audio status: the run logs waveOut opening 22050 Hz, mono, 8-bit, voice 720897.
This unchanged route did not capture PCM or conduct listening, so audible
output, audio quality and synchronization are unqualified. There is no measured
FPS; batches/second is not FPS. No Windows comparison was performed.

## Preservation and handoff

Local run: `scratch/runs/20261021-hock-final-size-canonical-runtime`.
The sibling evidence archive contains the 36 sealed remote evidence files,
complete gameplay log, eight images, source/package/module identities,
original recipe, adapted drivers, commands/Boat receipts, validation and
recovery instructions. `validation.json` verifies source identities, seals,
path-only adaptations, test exits, intended assertions and route dispatches.
Essential remote evidence was copied locally at approximately 06:21 UTC,
well before the 08:05 preservation deadline. The local checkout was sparse
before materialization, uses the existing object store, and no local full-source
or full-VM build occurred. Total local allocation remains below 64 MiB and free
space above 2,285,895,680 bytes.

Runtime `bx_c6f3np32` remains RUNNING (API state `idle`, health `ok`), expiry
**2026-10-21 08:14:54.696 UTC**. No test process remains. Raw modules, source,
dependencies, original assets and evidence remain under
`/home/user/hock-final-size-canonical-runtime` for coordinator preservation.
The coordinator owns shutdown; this worker performed no box lifecycle action,
spawned no workers and made no new assignment. Main remains
`1d8dbd7a44656178d01869f28869be624a59fa39`. Report publication identity is in
the local `publication.json` and append-only messageboard. Bounded task complete.
