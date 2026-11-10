# LBreakout original pause control and terminal visible nonresponse, 2026-11-10

The original executable supports ordinary local-game pause/resume with `p`.
The new generated native workflow is published and passes offline consumer
controls. Its single authorized original experiment stopped at the first
unconfirmed visible pause. Score remained 0, the ball stayed attached, and no
life loss, launch, score increase or first-level clear was observed.

Evidence: `scratch/runs/20261110-lbreakout-native-pause-score-0057/`.
Code commit `001103a7c` was committed on main after focused tests and locked
build, then immediately pulled/pushed using strict SSH. The run used that exact
commit, module SHA-256
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`,
and 824 SHA/size pins. Exact Git SHA and relevant binary diffs, including small
run-specific helper patches, are retained. No source/media archive was made.
Accepted unchanged fixture evidence from `4fc62b7d7` was hash-verified and
reused without another fixture. Bound-owner selection from `420e12095` remains
unchanged. Nox, Q3, providers and the passive lane observer were not edited.

The authentic EXE hash is
`cc1fd5c3d229cc1d4f910e658f5abefa80ef8ebf4b5e47801648f0be0e1ca244`.
Its embedded help explicitly says `p` pauses the game. Original disassembly
shows `_handle_default_key` at `0x41e474` comparing symbol 112, branching to
`0x41e75c`. For a local game with an active player, state 8 becomes state 20
and calls `_display_text("Pause")`; a subsequent `p` in state 20 restores
state 8. This is an actual original handler, not a guessed pause key.

`pause_workflow_source()` extends the actual generated browser caller with
ordinary `p` and bounded `play` commands. A play command requires an attestation
that the exact previously reviewed image visibly showed pause. It admits that
image through the existing bound-owner chain, sends balanced native `p` to
resume, a short supported paddle/fire pulse, and balanced native `p` to pause
before capture. Each UP remains independently scheduled. A failure prevents
later play/pause/input/capture. No guest routine is invoked artificially, guest
memory written, emulator frozen, clock changed or deadline extended.

The actual generated entry point ran offline with process/CDP boundary adapters,
three guest Workers, module/owner binding, pause/resume/play/re-pause, independent
release, wrong command/image binding negatives and sticky first visual failure.
The existing generated caller's unknown-input and refusal controls also passed.
A separate full original launcher completed ordinary close, actual parent wait
0 and independent stdout/stderr EOFs. These are offline controls, not visual
pause acceptance. Initial offline setup errors (an out-of-range test deadline
and a changed helper hash) were fixed here before passing. Seven permanent
inspection/handoff tests, original SDL/handler controls, three native-key tests,
and `flock /tmp/wine-build.lock bash tools/build.sh` passed before the code
commit. There was no local Chrome or nested worker.

The one original reached Loading, the main menu, Local Game submenu and the
first Late At Night board. All nine returned images were individually reviewed
before dependent input. At the ready board the paddle/attached ball were
centered, the bricks and life indicators intact, and score 0. The next command
armed the accepted passive observer and sent ordinary native `p` for 80 ms,
then waited 200 ms before capture.

Passive records show:

- Trusted native `KeyP` DOWN at 01:03:22.085Z and UP at 01:03:22.164Z.
- Independently scheduled UP at its original 80 ms deadline; both ACKs passed.
- Original SDL DX5 consumption of scan 25/data 128 at 01:03:22.157Z and
  `SDL_PrivateKeyboard` entry with symbol 112, down 1.
- The observer stopped normally at its existing 200001-boundary limit. It did
  not record the original pause handler invocation, pause state or P release
  consumption. The saved page input records show the released P still queued.

The first post-P image at 01:03:22.475Z was byte-identical to `level-ready.png`
(SHA-256 `f6b1be794506bd3d4beda9022cd9665af03f31e80b5fe59200de741ba2f0a7c7`).
It showed no Pause overlay. That does not prove the original ignored the key:
SDL consumed its correct symbol. The last saved guest PC was `SDL_MapRGB+0xa`,
consistent with ongoing surface drawing; it does not establish pause-state or
display completion. The specific terminal condition is that visible pause was
unconfirmed at this first bounded capture. No later capture was used to wait
for an overlay, and no resume/play or Space command was sent.

Immediately upon that image review, owning native cancellation sent SIGTERM
to Chrome 6313 and Node 6304 at 01:03:36Z. Node's actual parent wait was -15,
with separate stdout/stderr EOF records. No independent Chrome reap is claimed.
There was no later game protocol, input, capture, retry, quit or extension.

All 121 remote artifact references, 103 unique contents, were independently
retrieved and SHA/size verified; all 824 remote pins remained unchanged. All
nine PNGs also passed full pngjs decode/CRC verification before normal stop.
Fresh box `bx_qyqc2khs` had prearmed independently observable immutable watchdog
UUID `7d8ebab5-f789-4b39-bfee-fcd72796a284`, original API expiry
2026-11-10T01:25:55.247Z and watchdog deadline 01:25:55.952Z. The sole delegated
normal stop, `stop_8cf53214e1f68593`, completed unforced at 01:04:32.581Z.
Independent final API state is archived, expiry null. The watchdog's actual
wait returned 0 with both EOFs, separately from the original launcher records.
Inherited boxes, including `bx_nmaechnr`, were untouched. Home stayed above
1.5 GB free.

The remaining issue is visible completion of the original pause transition;
a 200 ms post-pulse capture did not confirm it. Any further original experiment
requires separate authorization. This worker releases its files and stops.
