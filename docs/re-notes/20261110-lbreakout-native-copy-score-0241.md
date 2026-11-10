# Original LBreakout score and brick progress with native CRT memcpy

Evidence: `scratch/runs/20261110-lbreakout-native-copy-score-0241/` (ignored).
The single fresh original runtime visibly advanced Michael's score from **0 to
200** and removed bricks from the lower-right of the original level. The final
returned image, `review/original/paused-return.png`, shows the yellow Pause
overlay, score 200 and openings where the initial board had light bricks.
This establishes score/brick progress, not a level clear or sustained play.

**Protocol deviation:** after the repeated Right pulse returned an unchanged
paddle position, I continued ordinary play rather than cancelling on that
possible visual nonresponse. This does not satisfy the requested strict
first-nonresponse rule. The score-200 image is retained as visual evidence,
but the run is not reported as fully compliant acceptance. The box was stopped
before the offline correction below; no further native run was attempted.

## Exact published runtime and offline checks

The runtime was sealed from published main
`9deab9f96e3a46e20ea1fdb8f0c2fdde84ba2ac2`, containing the CRT repair
`e7e0312bd`. Its actually captured owning Worker module is SHA-256
`4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9`.
All 830 staged file pins remained unchanged. Exact Git SHA, relevant tracked
binary diff, relevant untracked source patches and small run-specific helper
patches are retained. Git remains the source archive. No source archive,
evidence media copy, local Chrome or nested worker was created.

The live run used the unchanged observer. CRT, other shared providers,
Q3 and Nox remained read-only throughout. Reused accepted unchanged fixture
`4fc62b7d76540d0c937cae8cfb28d025ea1d6371`; its retained completion artifacts
were independently hash/size verified. There was no native fixture rerun.

The locked build passed with the repaired canonical hash. Eleven inspection
tests, generated pause/resume and level-start observer ordering tests, and
original compiled SDL input controls passed. The actual generated browser
consumer ran offline against current module bytes with success, wrong-command
binding, wrong-module binding, incomplete work, observer failure, presentation
refusal and foreign immutable owner controls. Completion used zero full-module
transfers within its presentation budget.

Additional run-specific controls execute separate P pause, separate P resume,
and balanced Space delivery with individual returned-image gates. A wrong
resume binding makes closure sticky, with no later protocol/input/capture/quit.
These boundary adapters never launch local Chrome and make no visual gameplay
claim. Their source is retained as small patches, including an initial offline
adapter syntax error and its correction.

## Reviewed native sequence

Each of 20 returned images was individually model-reviewed before dependent
input. Ordinary menu keys reached Start Original Set, then Late At Night,
level 1/25, Michael score 0, the original brick board, paddle and attached ball.
Ordinary P returned a usable dimmed board with Pause. Separate ordinary P
removed Pause and restored board colors. Ordinary Space returned a detached,
airborne ball.

The first progress pause succeeded but still showed score 0 and an attached
ball after a life loss. Ordinary further play stayed in this same runtime:
separate resume, short Right inputs and a second Space launch. A provisional
reading of that launch as score 20/brick removal was rejected by the next
paused image, which still showed 0. The correction is explicitly retained;
neither that provisional reading nor transient dark pixels support acceptance.
One repeated Right pulse's image did not establish additional movement, and
none is claimed.

After another separate resume, ordinary Right held for 300 ms visibly moved
the attached ball/paddle from about x351 to x507. A third ordinary Space launch
in the same runtime returned an airborne ball. The next ordinary P returned
the accepted paused score-200 image with multiple lower-right bricks missing.
The initial/resumed score-0 images and this final image are the sole basis for
the score/brick conclusion; no guest-memory score or brick values are used.

The caller admitted direct Left/Right pulses with CDP down/up acknowledgement
but no original paddle-consumption completion observer. That admission gap is
demonstrated by the generated caller; the reason for the unchanged paddle image
itself is not established. After stopping the box, the same worker repaired
the admission gap offline: direct Left/Right and the legacy combined `play`
command now refuse before any native protocol/input. Menu Up/Down, Enter,
separate P and ordinary Space remain available. Paddle input requires a future
original guest-completion observer. A twelfth inspection test covers both
directions, observe flags and combined commands. The full newly generated
consumer and real transport-consumption path also verify the refusal, owning
terminal closure, zero paddle edges/images and zero later protocol; separate
pause/resume/Space success and wrong-resume-binding controls remain covered.

The original two-second completion/presentation deadline was unchanged:

| Command | Guest complete ms | Presentation complete ms |
|---|---:|---:|
| Original level start | 1302 | 1328 |
| Initial P pause | 1429 | 1461 |
| Separate P resume | 101 | 157 |
| First progress P pause, score 0 | 1378 | 1421 |
| Second progress P pause, score 0 | 1302 | 1328 |
| Final progress P pause, score 200 | 1408 | 1449 |

There was no transport refusal, timeout, browser death, unusable image or
second native runtime. The visual-nonresponse deviation above remains explicit.
No guest
state/clock writes, artificial handler calls, instruction-budget changes or
deadline changes occurred. Normal successful closure followed the final image
review. Browser exit and actual launcher wait both returned 0, with separate
stdout and stderr EOF records.

## Evidence verification and final lifecycle

All 267 remote artifact references resolve to 226 unique local files,
7,724,314 bytes. Previously retrieved captures were reused by SHA/size instead
of downloading or copying them again. An independent reread verified all
unique hashes/sizes; all 20 PNGs passed chunk CRC, decompression and row-size
checks. No gzip artifact was present. Verification and actual launcher
wait/separate EOF preceded the sole delegated stop request.

Only new box `bx_hq83bkwe`, immutable UUID
`0d93a23a-b1ba-436d-90c2-4916ad5a9578`, was operated. The independent watchdog
was observed before allocation. Its immutable deadline was
`2026-11-10T03:07:30.100705Z`; initial API expiry was
`2026-11-10T03:07:29.468Z`.

The sole normal unforced stop, `stop_6c8acc8b88ede5b1`, completed at
`2026-11-10T02:52:05.619Z`. Final state is **archived**, expiry **null**.
The watchdog was actually waited and reaped with exit 0 and separate stdout
and stderr EOF records. Other boxes were untouched. The allocation helper's
messageboard line retained the old task label; the appended correction names
this task and the same exact box/UUID. It does not indicate another allocation.

Next: retain this verified score/brick baseline. Level completion, sustained
paddle play, audio and performance acceptance remain outside this result.
