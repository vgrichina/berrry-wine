# Original LBreakout gated menu/paddle attempt: first-image failure

Evidence: `scratch/runs/20261110-lbreakout-gated-menu-paddle-0326/` (ignored).

The single authorized native run stopped at its first returned image. The
individually reviewed `review/original/startup.png` shows a black SDL client,
with neither LBreakout menu nor loading artwork. The worker immediately sent
owning SIGTERM to Chrome 6448 and launcher 6438. No game command, input,
subsequent capture, retry, quit, extension or second native attempt followed.
Local Game, level start, paddle movement, pause/resume, Space and score were
not reached. This run supplies no gameplay acceptance.

Before allocation, the actual generated caller passed ten menu and nine paddle
transport controls, 13 inspection tests, original compiled SDL/Enter-handler
and paddle controls, pause and explicit level-start regressions, and a locked
build. The added `tools/lbreakout-installed-worker.test.cjs` executes the emitted
attached-Worker handler and actual `host.js` initialization in VM boundary
adapters. It uses the original `guest-worker.js` instantiate/installed-instance
statements, real compiled Wasm, original EXE/SDL loading and the emitted observer
preload. The actual generated arm/completion functions refuse replacement of
the installed instance, even with identical exports, and issue no later
protocol. These are offline controls, not a browser gameplay substitute.

The native generated caller included the `066634cdb` ordinary Enter gate and
`b1dc83b64` paddle observer. The `080064edf` unobserved Left/Right and combined
play refusals, explicit `completion:level-start`, command/prior-image binding,
and separate P pause/P resume/Space commands remain intact. A future unchanged
expected menu or paddle image remains terminal. Accepted fixture
`4fc62b7d76540d0c937cae8cfb28d025ea1d6371` was independently hash checked and
reused unchanged; no native fixture was repeated.

The saved caller exposes a concrete first-image admission gap: its readiness
predicate only asks whether the registered app has a guest Worker. It then
checks identity/Canvas2D and two page animation frames before capturing, with
no original guest display completion condition. Saved startup state is at
03:30:54.800Z; capture began at 03:30:55.020Z. Saved console records continue
through secondary-thread initialization and original `SetWindowText`
"LBreakout2" at 03:30:55.238Z. This establishes missing presentation admission;
it does not establish that the game was stuck or predict what another image
would have shown. No later image was requested to answer that question.

The same worker repaired that gap offline in the title-only generator.
`startup_workflow_source()` now composes with the full generated caller and
requires `installStartupCompletion` before the FIRST original image. With no
input, the observer follows the original SDL display return at `0x426026`,
then the original menu-manager display return at `0x410849`. It requires a
stable original menu and selected submenu link, immutable EXE/SDL generation
and owning thread, followed by the existing bounded page presentation. A
loading display without a menu is insufficient. The existing two-second
observer/presentation bound remains unchanged. The accepted fixture path skips
this original-title gate. Shared startup, renderer, CRT, clocks, tiers and
instruction budgets were not edited. Native acceptance of this repair is
unknown; the original menu manager was not run naturally by the offline
boundary controls.

Repair validation passed eight observer cases, seven full generated startup
cases, nineteen full generated menu/paddle cases with the startup gate, the
real-Wasm installed-instance control including startup arming, 13 inspection
tests, original compiled menu/SDL and paddle controls, pause/level-start
regressions, and a second locked build. Failure cases produce no first image
and refuse later key/capture/quit with zero protocol. Post-build original-media
and installed-instance controls passed. Native and repaired builds share module
SHA-256 `4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9`.
Development-only test discovery, VM cross-realm serialization and nested helper
path failures were corrected and retained in the evidence; none caused a
second native run.

The prearmed independent immutable 25-minute watchdog bound UUID
`74f48c58-881b-48e8-92ab-a324e89f3a27` to box `bx_qr9zkq77`. Initial API expiry
was `2026-11-10T03:55:23.715Z`; watchdog deadline was epoch
`1794282924.3102393`. After cancellation, 35 references to 33 unique artifacts
(2,612,893 bytes) were retrieved, deduplicated and independently reread for
SHA-256 and size. The sole PNG passed complete chunk CRC and decompression
verification. No gzip artifact was generated. All 835 staged runtime pins
matched. The actual launcher parent recorded wait code -15, plus separate
stdout and stderr EOF records, before evidence verification and normal stop.

The sole delegate issued an unforced normal stop only after that verification.
Receipt `stop_fc723d31667e6849` completed at `2026-11-10T03:31:55.790Z`.
Final box state is **archived**, expiry **null**. The independent watchdog's
actual wait returned 0 with separate stdout/stderr EOF confirmation; its
immutable deadline hash was rechecked. No other box was operated on.

Git is the source archive: the run records the exact native base commit,
relevant binary diffs, owned new test patches and small helper-input patches.
Media remains referenced by existing paths and hashes; no source-tree archive
or evidence media copy was created. Next requires separate authorization:
compose `startup_workflow_source(pause_workflow_source(...))`, obtain and review
the first completed original menu image, then individually gate Local Game,
explicit level start, paddle movement and separate pause/resume/Space gameplay.
This single-task worker has stopped.
