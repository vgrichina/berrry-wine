# MDK2 pending menu/game request: classifier defect, bounded correction

The `contradictory pending scheme` rejection published in `cf0c275ea` is a
demonstrated run-controller defect. The original program can retain applied
`menu` while requesting `game`, with the old startscreen Level still present.
The corrected run-owned classifier permits this specific pending request under
the existing post-Medium checks. It authorizes only finite input-free observation;
it establishes neither playable readiness nor eventual successful loading.
No production runtime change is justified or made.

Evidence and small recoverable helper patches are in
`scratch/runs/20261104-mdk2-pending-scheme-cause/`. Investigation checkout was
`484fcd89fffede6d4579fe61a92085aaa0d1d4d5`; captured execution remains
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, with canonical module
`cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`.
`inspect-cause.cjs` verifies all 422 files in the predecessor's final local seal,
the five relevant capture/PNG hashes, and the executable/scripts archive against
the captured runtime pins. Original media are referenced by existing path and
SHA-256; none are copied.

The original flow explains the pair:

1. `menu.lua:1061–1065` selects Medium, sets difficulty 0.35 and invokes
   `menu.diff.Go`. Lines 1080–1087 hide the menu, freeze Level, arm the startscreen
   timer for 1.2 seconds and start the fade.
2. `level0.lua:328–343` handles that timer. Selected-zero calls
   `mdkNewGame(1,9)` and **then assigns `newconscheme = "game"`**. It does not
   assign `conscheme` or replace the Lua Level table there.
3. The executable registers `mdkNewGame` to `0x4391a0` at `0x434ea9`.
   Its wrapper calls `0x42bbe0`, which calls `0x42cc80`. That function stores
   requested level/checkpoint at `0x4b712c`/`0x4b7494`, sets pending load flag
   `0x5ccb48 = 1`, and returns. This is a deferred request, not a synchronous
   invocation of Lua `level()`.
4. Main-loop code independently dispatches `SetConScheme` at `0x401333`.
   `menuinit.lua:21–25` copies the pending scheme to the applied scheme and
   clears the pending value. The main loop checks the load flag at `0x4019d2`,
   invokes loader `0x42c990` at `0x401a28`, and clears the flag. The loader's
   later `0x42cc1e` path dispatches the Lua function named `level`.
5. `mdk2.lua:373–398` sets both schemes to game, clears Level/Save, then assigns
   new checkpoint/level/section and loads the next script. Those are subsequent
   construction facts; they need not exist immediately after the timer request.

`original-source-excerpts.json`, `native-flow.txt` and
`native-byte-contracts.json` preserve selected original lines, disassembly and
eight exact PE byte contracts. Decoded script hashes match prior references.
These are static contracts, not forced execution of guest callbacks. The
captured sequence is consistent with this path; it does not contain an
instruction trace proving precisely where the guest stopped.

| Capture step | Captured native facts |
| --- | --- |
| 3184 | Highlighted New Game reported in the original personal review; startscreen/title, freeze nil, pending nil. |
| 3232 | Medium reported in its separate personal review; startscreen/menu, showmenu 1, freeze nil, pending nil. |
| 3280 | Medium result: menu hidden, freeze 1, startscreen/menu, pending nil. |
| 3296 | Same pending facts after one input-free quantum. |
| 3312 | Same Lua state and Level identity, level0/checkpoint0, startscreen/menu, freeze1/showmenu0; pending now game. Enter/Escape at native rest. |

`captured-sequence.json` records exact paths, hashes, timestamps and input
history. I personally viewed the retained 3312 PNG: the game area is black,
with no visible comic/tutorial/playable evidence. This historical view creates
no runtime review or input permission. Resource observations remain unchanged;
the observer does not expose the native level-load request globals above.
Black pixels or elapsed slices alone would not justify the correction.

The change in `transition-evidence.cjs` keeps the predicate: pending scheme must
be tagged nil **or exactly the tagged string `game`**. Its enclosing branch still
requires applied menu, startscreen, freeze1, selected0, current difficulty,
showmenu0, valid Level table, level0/checkpoint0 and no loadscreen, plus original
observer/worker/native command identities, input rest and resource guards.
Title/menu/foreign pending strings and malformed tags still reject. Game/game
construction and game/nil movie boundaries remain unchanged and cannot be used
to claim playability from this state.

`pending-control.cjs` and `phase-gate.cjs` are byte-identical to the prior helpers;
their local imports now resolve the corrected classifier. Small `control.py`
routing edits point both the pending helper and phase gate at this run directory.
`next.py` is unchanged. No runtime adapter, release authority, browser connection
or launch capability is supplied. A future separately assigned fresh run must
stage and hash-qualify this closure, retain the pinned original runtime and exact
VIEW/review/input-preflight protocol, and use a new output directory. The failed
3312 session and its original failure latch remain untouched; it cannot be
resumed through this correction.

Offline verification:

```
node scratch/runs/20261104-mdk2-pending-scheme-cause/inspect-cause.cjs
node --test scratch/runs/20261104-mdk2-pending-scheme-cause/test-pending.cjs
python3 scratch/runs/20261104-mdk2-pending-scheme-cause/test-route.py
```

All **54 controller/classifier controls and six routing controls pass**. The
actual 3312 JSON rejects under the old classifier and permits only pending
observation under the correction, without mutation. A synthetic receipt peer
exercises nil-to-game during a quantum and subsequent fresh review. Negatives
cover true contradictory/foreign schemes, malformed tags, wrong Level/file/menu
effects, held native input, stale review, foreign source/module, premature
playable claims, stronger phase routes, faults and preserved first-error latches.
Existing ACK/timeout/history/budget tests also pass. Synthetic transport pixels
are explicitly synthetic; no native callback is executed by these tests.

The 16-slice quantum, 32 pending quanta / 512 slices / 96 commands, shared
540-second anchor and aggregate construction limits are unchanged. Every quantum
ends at a fresh inspection barrier; exhaustion still stops. Original unchanged
26 unhighlighted/wrapper, 18 scene and five predecessor routing controls are
reused by exact sealed file/hash references in `reused-controls.json`, rather
than rerun. Changed pending and adapter paths were tested together here.

Only this note is committed. Relevant binary diff, Git SHA, small new-file
patches, test logs, dependency hashes and final SHA seal preserve the ignored
run helpers without source archives or module/media copies. A full build is
inapplicable to the note and ignored helper changes; no production code changed
and the sole local heavy lane remained with the Deus Ex worker. No Chrome,
heavy CLI, WASM instance, remote/box operation, guest writes, repaint, additional
input, subworker, successor or deployment occurred.

No box is assigned to this offline task. Historical `bx_ejf8j8yx` was returned
to the coordinator with expiry 2026-11-04T11:58:35.973Z. The coordinator's board
entry reports its normal stop completed at 11:37:28.747Z; this worker made no
lifecycle action or fresh API check. Next work, if separately assigned, is a
bounded fresh replay with this exact correction. This assignment stops here.
