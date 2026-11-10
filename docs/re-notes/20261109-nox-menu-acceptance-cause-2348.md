# Nox menu acceptance: missing consumer state prevents a causal repair

Run `scratch/runs/20261109-nox-menu-acceptance-cause-2348/` stops offline.
The first concrete blocker is the absence of the mouse consumer state needed
to reproduce the demonstrated Conjurer stall. A route difference is established;
its causal effect is not. No production driver change, allocation, native
fixture, original launch, or new gameplay result is claimed.

Nine retained images were individually model-viewed and SHA-256 checked
against their capture records. The successful 2255 and failed 2325 runs have
**byte-identical** `step-009-flag-place.png` images (SHA-256
`5f612fd198573648d508f90e3a5fa016a9d09b1ecc8ea580d26f6d4235d6745b`).
They show selected Conjurer, visible Accept, and the guest cursor near
screen `(620,470)`. Their first nine actual commands also match exactly.
The successful next command was native click `[0.025,0.477]`; the failed run
instead first clicked `[0.5,0.794]`, then tried `[0.025,0.477]`, then Enter.
The first failed click leaves the guest cursor near `(620,470)`; the retained
point subsequently moves it near `(465,550)`, above Accept. Enter preserves
that selection screen. The successful image instead reaches default Jack
customization. This is a stateful route divergence, not evidence that the
retained point stopped working in an otherwise identical consumer state.

Both recorded canvases are intrinsic `640×480`, with CSS rectangle
`945×855` at `(0,34)`. The generated mouse helper maps `[0.025,0.477]` to
CSS `(23.625,441.835)` and the browser bridge's logical canvas `(16,228)`;
`[0.5,0.794]` maps to CSS `(472.5,712.87)` and logical `(320,381)`.
These are not guest software-cursor coordinates. The two retained-point
mouse receipts record the same CSS destination and 150ms hold. Native mouse,
binding, and key helpers are byte-identical between runs. Generated consumer
source differs only in its immutable plan digest, as checked after normalizing
that one digest. Both native capture identities bind the same primary module,
SHA-256 `3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.
No driver logic regression is demonstrated.

The production `lib/browser-input.js` bridge can suppress absolute movement
while relative capture is pending, and uses relative counts plus the renderer's
virtual cursor when locked. Task-local controls execute this actual bridge
with the actual generated native mouse helper: the same centered click reaches
logical `(320,381)` in the absolute case, produces no absolute move in the
pending case, and clicks the virtual `(420,300)` in the locked case with
explicitly zero movement counts. Those pointer states/counts are synthetic
controls, not recovered facts about either native run. The retained evidence
does not record pointer-lock state, the exclusive presentation transform,
virtual cursor/DI reference state, DOM movement counts, or guest DirectInput
consumption at the failing commands. The archived terminal run must not be
resumed or queried to fill that gap.

The existing offline Node peer in `tools/nox-current-driver.test.cjs` directly
emits listener events; it does not run the production canvas input bridge,
renderer routing, or Nox's input polling. A passing peer route therefore cannot
validate menu acceptance. The task-local route controls explicitly run both
the 37 successful actual requests and all 12 failed actual requests through
the current generated consumer, preserving holds and using zero post-action
waits and the peer's `command-N` transport IDs. Their returned identity/review
chains are checked. Neither result can
establish guest navigation.

The locked build, three native-input tests, all 27 generated-consumer controls,
and five additional whole-consumer binding controls passed. The latter alter
only external review/image reads: missing review, wrong SHA, foreign identity,
foreign label, and replaced PNG. Each asserts zero mouse presses, startup-only
capture, no Browser.close request, no protocol after terminal publication, and
separate child stdout/stderr EOFs. Eight exact builder CLI/function controls
check terminal markers, initial image/hash/label binding, review text and label
construction; the 37-command builder output matches actual successful requests.
The real browser bridge's three pointer-state controls and existing relative
input, clipping and lock-gate tests passed. Both complete route controls passed,
demonstrating the peer's inability to distinguish this actual guest failure.
These are offline Node/control-flow results; none proves native guest repair.

One initial integration invocation ran before generation had published its
manifest and returned local ENOENT. `integration.log` retains it; no peer or
Chromium started. The subsequent complete invocation used the sealed generated
files. This was test sequencing, not an input retry or a diagnosis of Nox.
Recovery uses the exact Git base in `git-base.txt`, the generated plan's Git
commit, empty relevant uncommitted-source diff, generated provenance patches,
and small `run-inputs.patch`. Original media and retained images are referenced
by existing paths and hashes. No source-tree/media archive was created.

The separately reviewed accepted staff images still establish the explicit
Force of Nature Staff of Recharge label, equipment with charge 3, and green
particles with charge 2 while the northeast door remains intact. They do not
establish target damage. This task performs no staff recovery or attack.
The next necessary evidence is passive observation of the actual input boundary
(DOM coordinates/counts and lock state, presentation/virtual cursor, DI delivery
and consumption), bound to the reviewed Conjurer image, sufficient to select
and causally test a changed route. Replaying either unchanged failed sequence
or interpreting a transport ACK as guest acceptance would not resolve it.

Box ID, state, expiry, watchdog UUID and stop receipt: **not applicable**;
this worker created no box. No owned live runtime remains.
