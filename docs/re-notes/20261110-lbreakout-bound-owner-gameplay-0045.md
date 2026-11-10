# LBreakout bound-owner input and original gameplay, 2026-11-10

The published bound-worker correction works in the original game. An authentic,
independently released Left80ms pulse moved the paddle and attached ball 40
pixels left. Prearmed passive records show the original SDL DX5 consumer and
original paddle handler consuming that input. Space80ms then launched the ball.
The next image showed changes in the brick grid, a lost ball and a recentered
paddle with the ball attached. Score remained 0. No score progress is claimed.

Evidence is in `scratch/runs/20261110-lbreakout-bound-owner-gameplay-0045/`.
The runtime was prepared from main `91c85924578449d7713a5f2a3c6394a15943f092`
(including `420e12095` and `b2ceec0c7`), with
821 SHA/size pins. Exact full Git SHA, relevant uncommitted source patches and
small run-specific helper patches are retained; Git remains the source archive.
No source/media archive was made. The accepted unchanged fixture from
`4fc62b7d76540d0c937cae8cfb28d025ea1d6371` was hash-verified and reused without
rerunning it. Shared Q3/Nox/provider code was not edited.

Before allocation, the entire actual generated assembly and original launcher
ran offline through the accepted-fixture completion gate, literal deadline,
browser entry point, three guest Workers, bound-owner selection, observer arm,
Left80ms DOWN/independent UP, capture, ordinary close, actual parent wait and
separate stdout/stderr EOF records. A missing `generated.cjs` dependency in the
new run preparation was fixed in this worker before the passing execution.
Six inspection/handoff tests (including eleven handoff negatives), original
SDL/handler controls, five native-key tests, generated caller terminal/refusal
controls and `flock /tmp/wine-build.lock bash tools/build.sh` passed. The build
left every staged pin unchanged. There was no local Chrome or nested worker.

The single fresh original reached Loading, main menu, Local Game submenu and
the first original board using five balanced Down/Enter80ms menu pulses. All
eleven returned PNGs were individually model-reviewed before dependent action.
The clear first board had score 0, intact bricks and an attached ball above the
paddle at page x351. The observer selected admission-bound guest target
`7593A20F12EB155791773B89EDF015F4` among three guest Workers.

At 00:48:42.725Z the observer armed before native Left DOWN. Its records prove:

- DX5 consumed scan 203, data 128, and SDL_PrivateKeyboard set symbol 276.
- The original paddle handler entered with `left=1`, `inhibit=0`, x293 and
  elapsed 80; its matching original return had x253.
- Independently scheduled UP ran at its original release deadline, 80ms after
  DOWN. DX5 consumed scan 203, data 0; SDL cleared Left, and later paddle
  returns remained at x253. All fourteen saved native key edges were trusted
  and balanced.
- The separately reviewed after-Left PNG shows paddle and ball at page x311.

The observer ended normally at its existing 200001-boundary limit after 29
records, with all observed keys released. No guest handler was called
artificially and no guest memory was written. These records exclude collapsed
DOWN/UP and paddle inhibit as causes of this particular Left pulse. They do
not establish the cause of any older unobserved original input attempt.

Space80ms produced a separately reviewed detached ball at page (77,549).
The following supported capture at 00:49:18.810Z showed a recentered attached
ball and fewer life indicators. The bottom brick-grid cell at column 1, row 10
also visibly changed; pixel comparison is retained, without assigning a
destroyed-brick count or an unsupported score explanation. Score still read 0.
The worker conservatively treated this first gameplay life loss as the task's
terminal "death" condition. It did not equate this with emulator/process death.
At 00:49:42.954Z it sent native SIGTERM to owning Chrome 6273 and Node 6264.
No subsequent game protocol, input, capture, retry, quit or deadline extension
occurred. Node's actual parent wait was -15, with separate stdout/stderr EOFs.
Chrome's own wait/exit callback was not published before its owner was killed;
no independent Chrome reap is claimed.

All 141 remote artifact references, 120 unique contents, were independently
downloaded and SHA/size verified before normal stop; all 821 remote pins were
unchanged. Each PNG had already been decoded for individual model review.
An additional PNG verification command found Python Pillow unavailable; the
subsequent pngjs full decode/CRC check passed for all eleven images after stop.
This later CRC check is recorded separately rather than backdated as a
pre-stop check.

Fresh box `bx_nmaechnr` had independently observable immutable watchdog UUID
`e9e531ee-b1d9-4ea5-86cf-604b8ab29ec2`, initial API expiry
2026-11-10T01:11:46.144Z and deadline 01:11:46.540Z. The sole delegated normal,
unforced stop was `stop_2db70dd630bbb3d0`, completed 00:50:14.130Z. Independent
final API state is archived, expiry null. The watchdog's actual wait returned
0 and both EOFs are retained separately from the browser launcher's wait.
The coordinator also independently confirmed both current boxes stopped on the
messageboard. The previous `bx_4hej5rrn` was untouched. Home remained above
1.5 GB free.

The owning-worker fix is already shipped and is now verified with visible
original paddle movement and ball launch. Score progress remains unattained
at the terminal life loss. A future task would need explicit authorization
for another original experiment; this worker releases its files and stops.
