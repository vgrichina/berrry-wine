# GLTron: original browser turns, round outcome and ordinary Quit

On 2026-11-18, the original registered GLTron 0.70 ran through the production browser WebGL route. In one round, ordinary A and S inputs produced two visible corners in player one's yellow trail while the yellow cycle remained intact. Resuming without further steering produced **PLAYER 3 WINS!**, with player 1 crashed. Ordinary Quit opened the original credits; Escape dismissed them and the actual guest process exited with code 0. No production code change was needed.

Evidence: `scratch/runs/20261118-gltron-current-browser-turns-round/result.json` (written last). The successful scope is `original4/`; earlier scopes are closed diagnostics, not substitutes for this browser proof.

## Source and actual route

The task prepared published main commit `44221dc3875fcad90f275f5054f1d0ce0272f94f`, current when preparation began. Its immutable Git runtime was served from memory, excluding other agents' uncommitted changes. The tested 2,410,413-byte module has SHA-256 `9862d12476ad04bd266de2e729dd7076f34951a5d1f85eaaf0843fda5c99cabd`; the actual guest and render Worker bytecode matched it. Shared main advanced during the task; this result does not claim to retest those later commits.

`prepared.json` records the runtime source hashes; `media.json` records all 92 registered GLTron inputs, existing paths, sizes and matching actual hashes. HTTP receipts record the actual served inputs. No media copy or modified game/config/INI was used. The route was `index.html?debug&threads&gl-renderer=webgl&app=gltron`, through the ordinary browser fullscreen consent button, original GAME menu and START GAME.

Headful Chrome used a private authenticated Xvfb/Openbox display. Existing `gltron-headful-display.cjs` captured the whole displayed browser through XGetImage, with PNG encoding in JavaScript. Existing binding reads checked the page process, window, canvas, GL endpoint, guest slot/endpoint, Worker instances, renderer generation and module identities before and after live captures and before input. The SDL audio Worker was allowed as a separate participant; it did not replace the pinned primary guest owner. WebGL observation identifies WebGL 1 / ANGLE Intel Mesa; this is not a physical GPU performance claim.

## Reviewed consequence

All paths below are relative to the run directory. Images are whole private-display captures, not cropped reconstructions.

| Stage | Selected image | Observed consequence |
|---|---|---|
| Menu and start | `original4/menu-ready.png`, `game-menu-ready.png` | Original title and selected START GAME |
| Before either turn | `original4/paused-arena.png` | Intact yellow cycle, paused initial arena |
| A during live play | `original4/corner-one-paused.png` | Intact yellow cycle; yellow minimap trail turns from rightward to upward |
| S during live play | `original4/corner-two-paused.png` | Same round; yellow minimap trail adds a rightward segment and second corner; changed camera heading |
| Natural round outcome | `original4/natural-outcome.png` | PLAYER 3 WINS; player 1, 2 and 4 crashed |
| Ordinary Quit selected | `original4/quit-selected-ready.png` | QUIT highlighted in the original root menu |
| Quit activated | `original4/after-quit-enter.png` | Original scrolling credits |
| Credits dismissed | `original4/ordinary-quit.png` | Browser shell, ExitProcess code 0; retained owner confirms process exited |

The two turn sequences were Enter (resume), A or S, then Space (pause), allowing review of the resulting corners. Pausing did not author game state. `corner-one-plan.json`, `corner-two-plan.json`, their deliveries, independently armed release receipts, actual child waits and trusted DOM edges record the sequences. Both ended with renderer physical key states all up. The guest input trace also records dequeued WM_KEYDOWN/WM_KEYUP for A and S. Those supported observations are not a fabricated native per-action ACK. Release ACKs identify CDP transport delivery only.

Every held key/mouse action had an independent finite release child armed before DOWN, including navigation and Quit. DOWN required current exact app ownership. The turn-sequence release children additionally carried the app owner; ordinary gesture release children validated browser PID/start identity and target and sent safety UP only. No native per-action acknowledgement was imposed as a prerequisite for ordinary UI play.

`ordinary-quit-retired.json` records `running:false`, `stopped:true`, `processExited:true`, `exitCode:0`, and `processExitCode:0`. This was recorded before host browser shutdown. The host `closed.json` deliberately does not claim ordinary Quit by itself.

## Bounded diagnostics and validation

The immutable original4 plan fixed 3,000 ms capture/transport, 90,000 ms scene review, 1,750 ms independent release fallback, 120 ms held keys, 900,000 ms runtime and 180,000 ms Quit reserve before launch. Prior fixture calibration measured whole-display acquisition at 98–200 ms and complete capture/encoding under 3 seconds, then demonstrated a visible native triangle scene change from ordinary browser Enter. The initialized presentation observer was used before binding the final output owner. No guest poll, synthetic wake/focus/clock, forged freshness or game patch was used.

Some immediately successful captures still displayed the previous scene while normal rendering caught up. Only personally reviewed later scenes established consequences. In particular `original4/paused-baseline.png` is a transitional title image and is not arena evidence. No UNKNOWN capture was retried or reopened.

Closed calibration failures exposed premature owner binding and an incorrect run-local require path. Original premedia failed before shell readiness; original2 incorrectly treated the new secondary audio Worker as primary owner replacement and refused before DOWN. Run-local orchestration was corrected to wait for actual initialized presentation and bind the primary endpoint/slot using the existing helpers. The positive authored browser fixture preceded original gameplay. Original3 reached menus and natural outcomes but its controller exited 1 without a retained fatal stack; the supervisor cleaned owned descendants with no leaks. Original4 added direct diagnostic file descriptors and fatal logging before its fresh launch and completed normally. The earlier unexplained controller exit is not claimed repaired, nor used as successful turn evidence. No closed endpoint was replayed; orphan original3 command files were never delivered.

Focused controller and capture-helper checks passed (the first combined invocation lacked the controller test's required output-directory environment; its corrected invocation passed). The canonical locked full build was attempted and refused the shared foreign `src/09b-dispatch.wat:$win32_dispatch` lifetime-review mismatch. This was reported on the board; the coordinator later reported that gate clean and passing. The earlier build refusal remains recorded. Only this documentation is committed; no code is published on the strength of that failed build.

The successful browser, Xvfb, Openbox and every release child have actual wait and stdout/stderr EOF records. The native supervisor records child exit 0, no termination and no leaks. Its outer launcher wait was not retained, so no outer EOF/wait is invented; original4 used direct stdout/stderr file descriptors, with no pipes to EOF. Earlier scope gaps are explicitly listed in the final result. No test box was created (ID null, state NOT_CREATED, expiry null, stop receipt null).

## Recovery and limits

Git is the source archive: recover runtime from the pinned commit and run `compile(gitFiles(pinnedCommit))` using the helper recorded by `prepare.cjs`; compare the retained unique `tested.wasm` hash. A fresh recovery compilation matched. The relevant pre/post worktree binary diffs document excluded shared WIP. Owned run-local scripts and this report have new-file patches, with hashes and recovery instructions in `recovery.json`. Media recovery uses the existing registered paths and hashes, never copied media. Selected image hashes, review identities and actual cleanup receipts remain in the run.

This verifies the stated browser controls, one visible round outcome and ordinary Quit on the pinned production source. It makes no complete27, parity, FPS, audio or game-completion claim. Historical native Node gameplay remains historical and is not browser gameplay evidence.
