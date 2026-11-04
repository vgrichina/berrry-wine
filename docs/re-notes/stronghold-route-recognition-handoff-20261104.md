# Stronghold route recognition handoff, 2026-11-04

The ChooseType handoff is repaired offline across the complete original caller
chain. A further known hover recognition mismatch blocks the onward attempt.
No browser or original game was launched for this assignment. Evidence:
`scratch/runs/20261104-stronghold-route-recognition-handoff/`.

The chain is `successor-driver` → `install-route` → setup-preset `navigation`
wrapper → current-request `navigation.scene`; `wireRouteCommands` and its
`PhysicalRoute` use that same navigation implementation. The previous title
adapter changed only explicit-idle `navigation-plan.scene`, which returned
`crusader-type`. The independent route classifier required `choose-type` and
compared both an exact header and an exact tower crop. Repairing only the menu
classifier could never repair that handoff.

`tools/stronghold-route-recognition-handoff.cjs` composes the route classifier
after checking its immutable source hash. It reuses the bounded header check
and compares all pixels of the original tower crop (460,420,260,180). Both
authentic recent captures differ from the sealed original by131 of46800 pixels,
2365 maximum-channel absolute error, with52×30 tile maxima28 pixels/908 error.
Bounds160/3000 overall and35/1200 per tile provide small fixed headroom. There
is no alignment, scaling, masking, animation exemption or new acceptance hash.
Geometry and opacity remain mandatory. A SHA-pinned historical composition
manifest fixes all30 original helper hashes; changed or omitted dependencies
reject before evaluation. Historical sealed helpers remain untouched.

The actual composed `install-route` branch and actual route driver accept the
sealed original and both authentic recent ChooseType captures. The positive
test stops at the physical Custom Game move sentinel. Negative tests reject
header/tower shifts, cropped geometry, wrong scenes, concentrated tile changes,
stale ticks/pixels, foreign Worker identity and invalid personal review before
input. Modified source and omitted closure pins reject. A transport simulation
using authentic capture pixels executes the composed route through hover,
balanced down/up and19 complete64-step ACKs, stopping at the fourth exact
historical shell sample (1088 steps after release began). This is an offline
transport fixture using the latest ChooseType followed by a historical hover;
it cannot establish current hover compatibility or runtime qualification.

All26 historical route captures from current-request, setup-preset and resolved
binding retain their original scene classifications: ChooseType, Custom Game
hover, intermediate setup, complete setup and preset hover. Historical arrival,
Zephyr and exact full-game shell recognition also pass. Existing executable
owning Worker callback fixtures pass for both retained modules, and the shell
audit passes its22 negative controls. Title/menu regressions,32 local contract
negatives plus an actual foreign child, and the locked full build pass.

The next hover gate is already incompatible with the latest authentic static
geometry. Its header crop (110,315,660,75) and map crop (160,480,260,120) are
byte-identical between the original unhovered ChooseType and original hover.
The latest authentic unhovered capture differs by113 pixels/1804 error in that
header and321 pixels/7028 error in the map. The exact hover gate therefore
cannot be presumed to work after the handoff repair. `inspectNextHoverShared`
reproduces this diagnostic without granting hover acceptance.

The audit searched retained November3/4 Stronghold route/hover PNGs, including
recovered captures:79 distinct captures,30 exact historical hovers, zero with
the latest shared header/map hashes. No authentic current hover capture exists
in that audited set to validate the full hover-specific recognition boundary.
The hover text and all later recognition gates remain unchanged. No synthetic
hover image, invented signature or speculative wider threshold was accepted.
The single onward attempt was withheld under the instruction to stop when the
next checkpoint cannot be resolved from authentic evidence, rather than spend
a live run demonstrating a rejection already known offline.

The finite local contract was renewed and tested for this assignment:
720s browser,60s bootstrap,40s command,180s cleanup reserve, absolute Chrome
cutoff20:20Z/cleanup20:23Z, actual host/boot/PID/start/run/candidate/modules and
fresh nonce. It was never used to launch. Filesystem pins cover2429 files and
all1856 original media paths;164 full-body HTTP pins pass and that preflight
server closed. Final offline candidate main was `dec72d70d555166b5abfdd61ce239c75ea8e7865`
plus recorded relevant patches. Existing modules are referenced by path/SHA:
normal78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664,
compatibility99b579cd17b57f94145df92ae6d28110f24fc284d13a1b2c0ebe3596bd10a77f;
original EXE9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f.

Prior MDK Chrome894623 and Node894431 remain absent, HTTP33021 refuses, and
the correct local runtime flock was available. The prior Chrome SIGKILL remains
abnormal with cause unproved. This assignment acquired no heavy runtime lock;
its HTTP preflight server closed. The local slot was explicitly released on the
board at18:39:17, after GLTron's18:36:33 release, for the serialized successor.
Box ID/state/expiry are NA; the coordinator owns future boxes and shutdown.

Next: obtain authentic evidence for the current Custom Game hover boundary in
a separately scoped diagnostic, then validate every affected exact crop before
authorizing dependent press/release. No preset, Start, guest writes, forced state,
retry, guard bypass, world or hostile-engagement claim occurred here. Git SHA
and relevant binary/new-file patches preserve source recovery; no source tree,
media or module copies, snapshots or archives were created.
