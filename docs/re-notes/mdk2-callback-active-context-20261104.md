# MDK2 Medium return, command active and final collection context

Input: published `12a87f17971452efbbeecb88778a1bdc1f863955` and
[its original decoder/release evidence](mdk2-decoder-return-original-20261104.md).
Evidence: `scratch/runs/20261104-mdk2-callback-active-context/` (RUN).
**No observer/driver defect is demonstrated.** The final native stack locates
main-loop Lua garbage collection. Native command `active=1` is a result retained
after synchronous dispatch returns, not a callback-in-flight flag. The existing
full-rest requirement `active=0` remains unchanged. No runtime was launched.

The bounded offline audit verifies the original executable SHA-256
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`,
32 exact instruction contracts, original scripts.zip and three decoded-script
hashes, all 29 append-prefix observer checkpoints and the retained frozen
main/file sidecars. Original media remain at
`test/binaries/candidates/mdk2-demo/installed/mdk2demo/`; RUN records existing
input paths, sizes and SHA-256, selected disassembly and script excerpts.

| Boundary | Original contract and retained evidence | Conclusion |
| --- | --- | --- |
| Decoder output request returns | `0x47ca79: e8 02 0f 00 00` calls `0x47d980`. Five observed returns to `0x47ca7e` have EAX=32768, correct ESP=frame+28 and decodedWords=0. RemainingWords falls from 11083162 to 11017626, still positive. | Five finite byte requests completed. Neither the complete compressed stream nor a Lua callback completes by implication. |
| Original Medium command dispatch returns | `0x46cf7e: 89 5e 24` clears command+36 before dispatch. Release/flags2 at `0x46d0bf` calls `0x42ae70`; only after its return does `0x46d0c7: c7 46 24 01 00 00 00` publish active=1. `0x46d0d6` then stores raw into previous. | At 4080–4128, flags2/phase2/raw0/previous0/active1 plus freeze1/showmenu0 support completed synchronous Medium dispatch. This is a byte-backed inference from state, not a recorded instruction-level Medium entry/return pair. |
| Whole-stream completion | `0x47d980` stops on fulfilled requested bytes or exhausted decoded/remaining stream words; zero decodedWords alone is not EOF. | Full stream, external read state and later stream termination remain unknown. No whole-stream completion prerequisite for every future main-loop action is established. |
| Full native command rest | A subsequent `0x46cf30` poll clears active at `0x46cf7e`. No such next clear is captured. | The stricter raw0/previous0/active0 guard remains unsatisfied. Returned dispatch and full rest are different witnesses. |

Renderer `activeInput` has separate ownership. In the actually served Git
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad:lib/renderer-input.js`,
`takeInput` publishes the dequeued event and clears `_activeInputEvent` on an
empty queue poll. It does not clear the game's command+36. Command79's ACK
proves delivery; the drained queue, null activeInput, native raw/previous0 and
Medium effects by4080 additionally prove consumption and progress. Neither
renderer null nor native active1 is a pending asynchronous callback handle.

The early decoder stack at3664 is consistent with maintenance under the main
loop: `0x402171 → 0x451540 → 0x47c600/0x47c610 → 0x47bf90 →
0x47b1a0 → [stream+8] → 0x47ca50 → 0x47d980`.
The retained stack contains return PCs `0x402176`, `0x451546`, `0x47c626`,
`0x47c012`, `0x47b393`, `0x47a928`, `0x47ca7e`, and the original wrapper at
`0x47a923` calls `0x47ca50`. The indirect stream object's callback field was
not captured, so that edge is stack-supported rather than a direct field read.
This places decoding in buffered-stream maintenance; it does not identify the
entire media stream or make decoding a child of Medium's later callback.

At4128, the owning main thread is slot0/thread1, PC `0x4434a0`,
ESP `0x074ffd40`, EDI `0x083fab80`, EBP17, EBX408. The exact saved-frame layout
matches this chain:

`main 0x402187 → collector 0x443070 → mark-roots 0x443240 →
root visitor 0x444aa0 → tagged-value marker 0x443320 → table marker 0x443460`.

Relative to final ESP, +16 is return `0x44334d`, +20 the EDI table argument,
+24 return `0x444ae3`, +48 return `0x44324a`, +56 return `0x443085`, and
+80 return `0x40218c`. The table marker sets its mark at table+4, traverses
24-byte key/value nodes and recursively marks both values; `0x4434a0` loads
table+12, increments the index and advances node offset24. This is ordinary
recursive reachability marking. The root caller is the periodic main-loop
collection after the frame counter reaches five, not evidence of the separate
`level()` script's explicit `collectgarbage()`. The table's node bytes/count
and full reachable graph were not retained; collection's remaining work and
return time cannot be calculated. File thread2 is separately at the supported
idle-file-poll Sleep return `0x4515cd → 0x451f62`, not a captured active archive
decode. This does not establish its future scheduling or future file completion.

The construction dependency follows the original scripts and deferred loader:
Medium `menu.lua:1062–1090` sets difficulty, hides the menu, freezes Level,
arms `startscreen`'s 1.2-second timer, closes/fades and switches music. The later
`level0.lua:328–343` timer handler conditionally calls `mdkNewGame(1,9)`, then
requests scheme `game`. As documented in
[the original pending-scheme map](mdk2-pending-scheme-cause-20261104.md),
native `0x4391a0 → 0x42bbe0 → 0x42cc80` records the deferred load; main
`0x4019d2/0x401a28` consumes it through `0x42c990`, whose later path invokes
Lua `level()`. That function clears Level, requests the type10 script and only
then can produce a new Level. These are static dependencies, not witnessed
execution in this history. Timer dispatch may occur within later frame work;
the evidence does not order it after a required next command poll.

The exact missing witness is same-history owning-main progression out of this
collection, correlated with the startscreen timer identity/deadline/firing and
its handler return; the native requested-level/checkpoint/load flag
`0x4b712c/0x4b7494/0x5ccb48`; then load consumption, type10 demand/completion,
script-buffer execution and new Level identity. Current observation retains
startscreen, applied menu/pending nil, completed old `pointer` resource, and no
new demand/finalizer/script-buffer/new-Level records. The level-load globals,
timer object and complete Lua call state were not captured. Thus no lost timer,
loader failure, stuck callback or eventual construction success is established.
An exact continuous Medium dispatch entry/return pair is also absent, though
the post-return active store supports the narrower return inference above.

Reproduction: `node scratch/runs/20261104-mdk2-callback-active-context/audit.cjs`.
It passes 32 byte contracts, 29 retained prefix checkpoints, 5 request returns
and 9 negative interpretation/frame controls. A pure ordering model illustrates
post-return active retention; it is not native execution. One initial audit
address transcription error is retained in `audit-initial.log`; the corrected
pin is `0x47d9e0`. No production/helper/test file changed, so no build or native
fixture execution is claimed. Git SHA, relevant binary diff and new-file
patches preserve provenance. No source snapshots, media/module copies, expanded
historical archive, npm, Chrome, game, boat, heavy runtime lock, admission,
retry, subworker or deployment was used. All 50M/360s owner/record/byte/input/ACK,
frozen-review, 16ms and 512/544 guards are preserved. Host overhead supplies no
progress-duration estimate. Box ID/state/expiry: NA; coordinator owns shutdown.
This bounded finding completes the assignment; stop without further execution.
