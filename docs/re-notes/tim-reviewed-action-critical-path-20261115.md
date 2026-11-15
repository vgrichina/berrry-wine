# TIM reviewed action critical path, 2026-11-15

**Operator path qualified; Puzzle 1 cleared and earned Advance reached Puzzle 2. Native Quit exited cleanly; Puzzle 2 remains partial.** Evidence:
`scratch/runs/20261115-tim-reviewed-action-critical-path/`.

The previous original is permanently closed. Its eight construction gestures
were positively UNSENT at 6.839, 8.197, 5.176, 4.390, 4.247, 4.485, 4.575 and
4.339 seconds after capture. Native Quit at 220.332 seconds is separately
proved; the controller's native-owner-changed UNKNOWN remains permanent.

This task retains five-second gameplay and thirty-second menu reviews, with
the full one-second dispatch reserve and every existing controller check.
The only candidate improvement is the real operator handoff: one tool call
requests the native complete scene and immediately returns its image; after
personal review, one direct Python invocation creates a fresh independent
intent and calls the existing exact-schema/admission/native transport.
There is no nested operator subprocess and no second image-view round trip.
The source capture timestamp is never moved or replaced by image-delivery time.

Before each capture, the operator may reason about one provisional action.
After the new complete image arrives, the operator must inspect the entire
scene, confirm or discard that proposal, and only then invoke `--gesture`.
The helper does not receive or save any future action during capture.
It requires the exact personally viewed frame ID before calling the unchanged
controller. It records hashing and atomic-write timings without caching or
skipping either operation. Actual native admission and visible consequence,
not unit-test timing, determine whether this path qualifies.

Native qualification and originals wait for Q3layout916770 then Sims966353,
their explicit releases, personally read direct actual waits with both EOFs,
and current PID/group absence. LIGHT preparation is not task completion.
No workers or boxes were created.

LIGHT measurements: five actual cold Python/import children took 170.96,
35.57, 29.30, 31.67 and 28.25 ms. Removing the nested Python launch is useful
but cannot explain or fix seconds of image/tool/model latency by itself.
The old capture-to-decision ages are recoverable, but its capture-return and
image-delivery boundaries were not recorded. Its successful menu/Quit commands
spent only about 1–5 ms between `reviewedAt` and the policy decision. Assigning
the earlier unmeasured seconds to native delivery would be unsupported.

Three new pure checks prove that a changed frame ID, a change racing between
the helper read and policy admission, and duplicate-key gesture schema cannot
create a written intent. The existing 26 policy, 12 schema and 10
dispatch-margin tests also pass. These are preparation, not operator latency
qualification.

The native diagnostic paints a complete 320×200 scene using executed x86 VGA
writes: three staged platforms with separate objects, a ramp, pipe, five
inventory tiles, seven bottom tiles and borders. An actual INT33 press callback
draws a small white marker at the manually chosen press location. Its renderer
uses the existing `screenSurface`/`rgbaFrame` path. It contains no game model,
puzzle solver, coordinate picker, image recognition or original game assets.
The independent deadline watchdog is prearmed by the existing supervisor.

Operator recipe (the same helper and handoff must be used for qualification
and any conditionally authorized original):

1. Reason about one provisional gesture without creating an intent or storing
   coordinates in a capture request.
2. In one `functions.exec` call, run
   `python3 -B test/test-tim-reviewed-action-path.py --capture RUN`, parse the
   returned PNG path, call `tools.view_image` immediately on that full image,
   and return its image with `image(...)`. Record capture tool return,
   image tool entry/return and the frame ID in conversation-local `store`.
3. Personally inspect the entire new current image. Confirm or discard the
   provisional action. Do not request another crop, conceal a difference or
   turn a proposal into a claim of personal review.
4. Only after review, call `--gesture RUN FRAME MODE SCENE TARGET CONSEQUENCE
   ACTION_JSON HANDOFF_JSON` directly once. Pass the stored frame ID and tool
   timing boundaries. The helper checks the exact frame again inside policy
   admission, validates the exact gesture schema, then delegates to unchanged
   `operate`/`Policy.admit`. Each call creates a new intent ID and nonce.
5. Wait through the finite gesture's independent release and actual post-UP
   native execution inside that invocation. No model turn, capture or further
   input is requested while held. Inspect a fresh complete consequence scene
   before choosing the next action.

An image-tool return is the earliest observable handoff boundary, not a
measurement of when the model finished seeing the image. The following
post-review tool request bounds the combined tool delivery, image processing,
personal review and model/tool generation time. Those intervals are reported
separately from hash/schema/write time and native receive/admission/DOWN/UP.
No exact cognitive latency is invented. Positive native UNSENT alone permits
another attested capture/review/new intent. Written ambiguity stays permanent
UNKNOWN and ends the run.

Any original stops construction before elapsed 600 seconds and targets genuine
native exit by 720. The helper enforces the earlier 600-second cutoff for
non-Quit original commands, including their independent release allowance.
Return to the native panel is started early while its gameplay scene can still
be reviewed within five seconds; the ensuing native menu/Quit scenes use their
ordinary thirty-second limit. Gameplay is never relabeled as menu to gain time.

Q3 released at 10:41:24 UTC (`56ceaa98…`); all 58 sealed waits and 61 current
actual waits, plus 185 PIDs/groups, were personally verified. Sims released
at 11:06:17 (`d6b27a22…`); all 991 sealed actual waits and 1,172 PIDs/groups
were verified, including native, watchdog, supervisor-child and launcher
records with both EOFs. Two release schemas required read-only adaptations
(checkout-relative paths and `explicitSourceBuildRuntimeRelease`); no heavy
work started before verification.

Current qualification passed the full locked build, 51 pure checks (26 policy,
12 exact schema, 10 margin, three new frame/schema checks), native context and
held-key checks, native exact schema and both margin cases, all 13 controller
cases, and two extra native changed-scene/owner cases. Both extra cases had
zero input delivery and permanent written UNKNOWN. Existing review-stale,
held, late/drop-ACK, written-stale and native-attested UNSENT cases retain
their original results. Qualification closure has 108 actual waits/both EOFs
and 108 absent PIDs/groups; the complete operator fixture raises these to 112.

The first actual personally reviewed fixture gesture was positively UNSENT
at 5.489686 seconds. A generic stored dispatcher shortened the post-review
tool expression, but the next gesture was still UNSENT at 4.263181 seconds.
Each refusal received native zero-send confirmation; neither wrote a command
or delivered a DOWN. New captures and new independent intents followed.

The concise dispatcher then admitted one manually chosen fresh click at
**2.994704 seconds** in game mode. The complete scene was personally inspected
again before creating that intent. Capture-to-image-tool-return took 74 ms;
image-tool-return to the post-review tool request took 2,851 ms; tool request
to Python entry took 69 ms; schema parsing took 0.264 ms; PNG hashing took
0.056 ms. Atomic decision and command writes took 3.559 and 2.844 ms. Native
admission followed the decision by 15.296 ms, DOWN followed admission by 43 ms,
and the native finite hold lasted 101 ms. Three actual INT33 callbacks executed,
held and native mouse buttons were false/zero, and the queue was empty.
The full changed scene was personally viewed: a white marker appeared inside
the chosen magenta tile. Native and watchdog actual waits both exited zero.
These are transport results, not TIM progress or a guarantee that every larger
game scene will fit the time window.

The material improvement is reducing post-image tool-call generation as well
as eliminating the separate image round trip and nested subprocess. The
generic dispatcher is installed before capture and stores **no action or
coordinates**. Its post-review invocation supplies the scene description,
target, exact gesture and expected consequence, with the current frame and
tool timestamps supplied by the capture handoff. The exact two generic
function expressions are retained in `operator-orchestration.json` in the run.
For repeat use in `functions.exec`, store the generic functions under `C` and
`D` (both parenthesized async-function source strings), then use the concise
calls below. `D` delegates to the published Python helper; it performs every
existing check and constructs no future action during capture.

```js
store("timOperator", {root: absoluteRunPath,
  helper: "test/test-tim-reviewed-action-path.py", mode: "game"});
store("C", `(async function(){
  const p=load("timOperator"),t0=Date.now();
  const r=await tools.exec_command({cmd:"python3 -B "+p.helper+
    " --capture "+p.root,max_output_tokens:1000});
  const c=JSON.parse(r.output),h={...c,toolRequestedAt:t0,
    captureToolReturnedAt:Date.now(),imageToolEnteredAt:Date.now()};
  const v=await tools.view_image({path:c.png});
  h.imageToolReturnedAt=Date.now();store("timHandoff",h);
  image(v.image_url);text({frameId:c.frameId,handoffAt:h.imageToolReturnedAt});
})`);
// Generic dispatcher, installed before any capture; no gesture is stored.
store("D", `(async function(scene,target,action,consequence){
  const p=load("timOperator"),h=load("timHandoff");
  h.postReviewToolRequestedAt=Date.now();
  const q=s=>"'"+String(s).replace(/'/g,"'\\\\''")+"'";
  const args=["python3","-B",p.helper,"--gesture",p.root,h.frameId,
    p.mode||"game",scene,target,consequence||"Native white marker at reviewed target",
    JSON.stringify(action),JSON.stringify(h)];
  text(await tools.exec_command({cmd:args.map(q).join(" "),max_output_tokens:1400}));
})`);
// Capture/view C returns the entire new image and stores only its metadata.
await eval(load("C"))();
// In a NEW tool call, ONLY AFTER personally reviewing that entire image:
await eval(load("D"))(sceneDescription, visibleTarget, freshGesture, consequence);
```

`C` executes `--capture`, parses its JSON response, calls `tools.view_image`
on the returned absolute PNG path, immediately returns `image(image_url)`, and
stores the frame ID plus capture/image tool entry/return timestamps under
`timHandoff`. `timOperator` holds only the run path, helper path and explicitly
chosen review mode. No capture call accepts a gesture. Full originals must
use this same concise handoff and dispatcher after publication, preserving
the existing source/native controls and source/module/build freeze.


The authorized original used the published helper (`edbdea8c8`) and this exact
capture/image/dispatcher path. It produced 58 decisions: 45 admitted inputs and
13 positively attested UNSENT refusals. Every refusal had native zero-send
confirmation and no command file; each subsequent attempt used a new complete
capture, personal review and independent intent. One malformed drag omitted
its required button field and was rejected by exact schema before intent.
No check, time window, reserve, capture anchor or UNKNOWN rule changed.

Actual gameplay now progressed: Puzzle 1 received three placed mouse motors,
three connected belts and a descending ramp. A misplaced second motor was
corrected through visible manipulation; the final placement was separately
confirmed. Run visibly moved the balls and drove all three conveyors. Two
individually reviewed ordinary waits advanced native execution without input.
The game displayed **PUZZLE 1 COMPLETED!**, bonus **618**. Continue opened the
Replay/Advance dialog; Advance reached **Puzzle 2: Tutorial Mirror Images**.
No password was typed. The older owner-question image is retained and labeled
historical; its password remains AMBIGUOUS and Telegram2791 was not answered
with a reliable transcription during this task.

Puzzle 2 received a mouse motor inside the right cage and a visibly confirmed
horizontal flip: the pulley moved from its right to its left side. Repeated
fresh belt attachment attempts were UNSENT at the reserve boundary. The belt
was not completed; Puzzle 2 had no Run or clear. Manipulation mistakes and
refusals consumed real time, and are not transport qualification successes.
The original's observable image-return-to-post-review-request median was
3,193 ms. `original-operator-phases.json` records each capture return, image
handoff, schema/hash/write event, independent intent, and native phase. These
measurements bound combined tool/model/review latency without inventing a
separate cognitive timing or claiming that unit tests fixed model latency.

Construction stopped before 600 seconds. The last scene still had the flipped
motor and an unconnected belt tool. A fresh five-second gameplay review
admitted right-button return to the native panel at about 589.954 seconds.
Only the actual subsequent menu and Quit confirmation used the thirty-second
menu limit. The native red Quit control opened **QUIT GAME**; a fresh full
scene review then selected **YES**. Native TIM reports `nativeExited: true`,
`nativeExitCode: 0`, elapsed **606.221 seconds**, `held: false`; no host
cancellation was used. The controller's `native owner changed` UNKNOWN stays
permanent, and no further capture or input was requested after it. The native
process wrapper exited 1 because of that UNKNOWN; watchdog exited 0,
supervisor-child and launcher exited 1. These wrapper results do not overwrite
the separate native exit proof.

All 447 input pins were reverified unchanged before report editing. Runtime
release personally verified 123 actual waits with both EOFs and 124 absent
PIDs/process groups, including direct native, watchdog, supervisor-child and
launcher waits; both locks were free. `runtime-release.json` records explicit
source/build/runtime release. Selected result PNGs show construction, Run,
clear, Advance, Puzzle 2's flipped motor and native Quit/YES separately from
the synthetic transport marker. No box was created (ID/expiry null, state
NOT_CREATED, stop receipt NOT_APPLICABLE). This one original is closed;
further gameplay requires fresh owner authorization. The next technical work
is reducing remaining operator latency without relaxing current guards.
