# Aranna browser prerequisite recovery, 2026-11-07

The ordinary browser prerequisite is recovered and verified on a fresh box.
The single unchanged-demo attempt stopped at a persistent title screen before
Main Menu. Map loading and player-controlled gameplay remain unverified.
Evidence: `scratch/runs/20261107-aranna-browser-prerequisite/`.

## Prerequisites and identity

Fresh box `bx_dgfrn3v8` was created at 04:44:55Z with a persisted UUID
Idempotency-Key, a 40-minute TTL and original expiry 05:24:55Z. No stopped box
was resumed. Ordinary npm provisioning installed the project's Puppeteer
25.7.0 with browser downloads disabled, plus pngjs and wabt. Puppeteer import,
`/usr/bin/google-chrome`, Chrome 151.0.7922.108, a rendered data-URL smoke page,
and normal browser closure all passed before guest launch. The smoke capture
and install log are retained.

Preflight verified size and SHA-256 for all 1,921 individual runtime, helper,
module and media inputs. Post-original verification matched all 1,921 again.
The tested checkout was `0570b3e09427b10624039622055736b59729f224`, containing
published GetFullPathName case repair `64823a6ad8bc73ada23f39a1f61573172d10837c`.
`base-commit.txt`, `runtime-dirty.patch`, `untracked-wininit.patch` and
`runtime-pins.json` preserve source identity without a source or media archive.
The actual instantiated observer module was
`e7d6617cecdf3275db05454763c07cad7e6eb557afc2a14ca3413d960328fd31`.
No guest executable, map, resource, save or configuration bytes were edited.
The retained ordinary browser driver, review requirements, instance/module
checks and input guards were reused unchanged; their imports passed preflight.
No new qualification or emulator build is claimed.

## One original and first blocker

The original started at approximately 04:46Z. I personally inspected each
capture with its matching state. The EULA appeared and ordinary Accept worked.
Opening logos and the Dungeon Siege Legends of Aranna title rendered. Ordinary
Escape skipped opening scenes. By `response-07` (04:48:29Z), the title appeared
over stone doors. It still appeared in `response-16` at 04:52:52Z, over four
minutes later, without Main Menu entries or an error dialog.

The original received balanced ordinary keyboard presses. A clear left-margin
browser click acquired pointer lock while the observer remained unarmed;
`response-13` records `mode=relative`, `lock=screen`, exact owning Worker/module
identity and a completed receipt. Subsequent focused Escape and Enter also
completed. No active lock was reacquired, no menu target was guessed, and the
native Single Player target observer was never armed because Main Menu never
appeared. The last additional observation followed a bounded 45-second passive
wait. No input-guard rejection, unknown action or held-risk retry occurred.

This is a **title-to-menu progression blocker**, not a selected-map failure.
Matching state shows the app still running, continuing slices and render
publications, no reported trap and no D3D errors. These observations do not
identify its cause or demonstrate a new emulator defect. No implementation
change is justified by them, and the earlier repaired map diagnosis was not
repeated. Normal movement was not attempted because no world loaded.

The complete retained stream has 26,960 records, including 24,812 broker
completions. There are zero observer errors or recorded copied-byte mismatches.
The two failed opens are the already-known startup probes
`C:\DungeonSiege.ini` and `c:\dir.lqd20` (error 2); neither is assigned as the
cause of this title stall. The guest never reached the map validator in this
attempt. Captures and healthy execution alone are not a gameplay pass.

## Closure

One ordinary queued quit completed at 04:53:09Z. Chrome exited normally with
code 0 at 04:53:12Z, and the supervisor also exited 0. All 143 unique retrieved
files (14,099,525 bytes) matched their download SHA-256 pins. Large observation
text was individually gzip-compressed with a round-trip byte check; original
size/hash and recovery path are in `compressed-evidence.json`.

Before stopping the box, cleanup independently verified all 11 owned PIDs
absent, HTTP 33813 and debug 39407 refused, the Chrome profile absent, and all
four runtime/browser/heavy/build locks free. Normal shutdown was explicitly
delegated by the task and requested only after evidence retrieval. Final box
state is recorded in the lifecycle JSON and result. No public deployment,
second original, nested worker, source-tree snapshot or media archive
was created. Local free space remained above the task's 2 GB floor.

Next work should investigate the retained title transition before authorizing
another original. This attempt does not establish whether the published path
repair permits map loading.
