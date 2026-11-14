# Forsaken exit diagnosis and terminal-owner lifecycle, 2026-11-14

The original back-buffer error remains: ordinary EXIT GAME followed by promotion
Enter reaches guest `ExitProcess(13)` at 214.580 seconds. No causal public-runtime
violation was established, so no Win32, D3DIM or guest-code patch was made.
The independently reproduced final-release lifecycle fault is repaired and
validated against public process/HTTP fixtures and this original-game exit.
`OWNER_EXITED` is explicitly neither physical-UP ACK nor a clean guest-Quit claim.

Evidence is `scratch/runs/20261114-forsaken-clean-exit/`; the final original is
its `validation/` subdirectory. `causal-analysis.json`, `input-audit.json`,
`lifecycle-summary.json` and `postflight.json` contain the compact conclusions.
The predecessor's UNKNOWN/child1, tool143 and missing additional waiter remain
unchanged, hash-pinned in `predecessor-preserved.json`.

## Original exit: evidence and remaining blocker

Bounded built-in API tracing covers calls 5175230–5175857, including the final
consumed Enter, ordinary rendering, teardown and exit. Immediately before
teardown, surface IsLost and presentation calls succeed. Teardown releases the
D3D device/surfaces; RestoreDisplayMode5175737 and
SetCooperativeLevel5175738(NULL, DDSCL_NORMAL) return DD_OK. Then:

- PostQuitMessage(0)5175833 returns to 0x428b28, with caller chain
  0x4274a1 ← 0x4264cb ← 0x4de67f.
- MessageBoxA5175843 reports `Cannot call D3DAppShowBackBuffer while
  bRenderingIsOK is FALSE`, with caller chain
  0x428b3d ← 0x427512 ← 0x4264cb ← 0x4de67f.
- ExitProcess5175857 and `[Exit] code=13` follow. The modal returns; it is not
  parked. No Peek/GetMessage, DestroyWindow or D3D/DirectDraw presentation call
  occurs between PostQuitMessage and the error.

Unmodified executable disassembly (`exit-static-disassembly.txt`) shows teardown
0x428ad7 invoking 0x4247d6, whose first store clears the game's render-ready flag
at 0xe774b4 before external calls. Its render caller returns at 0x4274a1 and can
continue to back-buffer show at 0x427501; the latter checks that flag before a
public present call and reports failure through 0x427512. This is a static
inference matched to actual return chains, not a live guest-memory observation
or proof that native Windows follows the same earlier path.

[PostQuitMessage](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-postquitmessage)
queues a request and returns; it does not abort an active render call.
[PeekMessage](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-peekmessagea)
retrieves WM_QUIT regardless of range. The known source range-filter discrepancy
cannot explain this interval: preceding actual Peek calls use min0/max0, and
there is no poll after PostQuit before failure. The
[SetCooperativeLevel contract](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdraw7-setcooperativelevel)
permits NULL HWND with DDSCL_NORMAL; the
[RestoreDisplayMode contract](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdraw7-restoredisplaymode)
does not establish the proposed synchronous callback needed to repair this
continuation. No failing public present or demonstrated missing callback
justifies changing those handlers.

The first causal public-runtime divergence therefore remains unestablished.
An earlier callback/message differential or matching native-Windows comparison
would be needed to distinguish the cause of this original continuation. Both
authorized original sessions are spent; no speculative patch, forced exit0,
third original or UNKNOWN restart was performed.

## Lifecycle repair and tests

The supervisor now includes the actual launch PID start token in its native
wait receipt, written after `wait()` and both output-drain joins. For a reviewed
final action with consumed DOWN, the independent release child can record
`OWNER_EXITED` only when that same PID/start identity has an actual successful
harness wait, stdout/stderr EOF and no drain errors, within the existing two-second
release cap. Endpoint closure alone is insufficient. Failed/signal waits,
non-final actions, unresolved DOWN, missing EOF and mismatched identity remain
UNKNOWN. The terminal records physicalUpACK=false, nativeQuitClaim=false and
noReplay=true. Ordinary real UP ACK/progress behavior is retained.

Six new focused regressions pass: real normal final exit, TERM, KILL, non-final
exit, late inherited stdout/stderr pipes with identity/invalid-receipt controls,
and absent wait. Corrected red evidence reproduces UNKNOWN/child1 and missing
wait identity before the repair. The first red invocation used a relative
fixture-output directory and failed before DOWN; its infrastructure failure is
preserved separately. The existing 29 controller tests and three production
input-owner/guard/progress test files pass. Native headless GL, driver identity
and the full heavy/build-locked `flock /tmp/wine-build.lock bash tools/build.sh`
pass. Test logs and actual process waits are retained.

The additional run-local invoker catches TERM and preserves its actual child
wait plus both EOFs. Real normal/TERM/KILL/late-pipe controls pass; KILL leaves
the killed waiter's own receipt missing, without manufacturing evidence.

## Bounded originals and evidence closure

The first fixed600/independent620 diagnostic started17:48:15 UTC. Bind was
positively refused during startup, 3.186 seconds before actual native GL context
creation: no owner, nonce or DOWN was assigned. The local controller stayed
closed. Read-only capture and explicit host cancellation followed; orderly
native harness0 is not guest Quit. The premature board assertion of successful
binding was explicitly corrected.

The final fixed600/independent620 validation started17:52:10 UTC. It observed
actual native GL context, successful submit and personally reviewed main menu
before its single permanent bind. Nine manual400ms actions selected Normal
VOLCANO, entered living play, paused, returned to main, selected EXIT GAME and
dismissed promotion. Quit phase began with474.747 seconds reserved. Eight
ordinary actions have real UP ACK, actual release-child0/bothEOF and subsequent
progress; the final action has consumed DOWN then distinct OWNER_EXITED with
actual release-child0/bothEOF. All captures were fresh within the supported
30-second menu window; all release/owner evidence was within2 seconds, with
unique nonces, no replay and no UNKNOWN in the final run.

Final DOWN consumed at1794678945.634; release fired at1794678946.034095;
actual native wait/bothEOF arrived at1794678946.060546 and OWNER_EXITED at
1794678946.072521. The failed release transport did not acknowledge physical UP.
Guest exit13 is separate from native harness0. Both original chains have actual
native/watchdog/supervisor/outer-child/additional-tool-child waits0 and separate
EOFs; independent watchdogs did not fire and heavy locks were released. External
execution-tool waits were actually reaped0 with combined EOF; their separate
stdout/stderr EOF remains UNKNOWN because that interface merges output.
All recorded native/outer PIDs are absent; closed port8527 is not ACK evidence.

All1648 pinned source files, both105-file loaded-source closures,894 media pins,
162 provider pins and tested module SHA256
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`
match postflight. Sources are recoverable from exact Git SHA plus relevant binary
patches, including the new test; no source archive, media copy or module bundle
was created. Provider recovery used153 offline npm files with scripts disabled
plus9 preserved native-cache files. The private installed modules were removed
after verification; the original cache and root dependencies are preserved.
Eight run-local inputs round-trip from Git patches. Ten named selected PNGs
passed CRC/inflate/SHA verification; other captures were removed with hash
records. Native logs retain every non-FS line with original line numbers.

The living scene shows lives5, SHLD128/HULL128 and PULS2000. This run sent no
combat inputs. Prior outgoing-fire proof remains prior evidence; target damage,
enemy kill, clean nativeQuit and full27 remain UNPROVED. `ENEMY KILLED YOU` is
player death. No box was created: ID=null, state=NOT_CREATED, expiry=null,
stop receipt=NOT_APPLICABLE. No deployment, workers or further originals.
