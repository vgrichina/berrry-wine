# Stronghold acknowledged-menu onward, 2026-11-04

The one authorized original reached the personally reviewed Custom Game hover,
then stopped **before Custom Game DOWN** on an owning-Worker discovery fault.
Both title-enter reviews were completed within the same command and its
successful ACK arrived before the next input. Main-menu, menu hover, Choose
Type, and current Custom Game hover reviews also completed normally. No Custom
Game press, setup, preset, Start, world gameplay or hostile engagement occurred.
There was no second original attempt.

Evidence is `scratch/runs/20261104-stronghold-acknowledged-menu-onward/`.
The predecessor is commit `d45ac6eba666efdffa01f057d85537ea0104af81` and its
[repaired-hover handoff](stronghold-repaired-hover-native-onward-20261104.md).
All 442 sealed predecessor artifacts, 15,274,761 bytes, remain unchanged. Git
commit plus relevant binary patches preserve source; media/modules remain in
place, referenced by path and SHA-256, without copies or archives.

## Original evidence

The runtime began only after MDK's 19:32:34Z release and GLTron's explicit
19:36:11Z release, under `/tmp/wine-local-runtime.lock`. The tested commit is
`5b4c56e108b0e906c279cfeb6b3251beaea89439` plus the prelaunch relevant binary
patch. All 2,429 filesystem pins, including 1,856 original media pins, 164
full-body HTTP preflight responses and 1,038 actual served responses matched.
The original EXE is
`test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`,
SHA-256 `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.
Normal module SHA-256 is
`78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664`;
compatibility module SHA-256 is
`99b579cd17b57f94145df92ae6d28110f24fc284d13a1b2c0ebe3596bd10a77f`.

I personally viewed the fresh registered selector and all startup samples.
Command 6, `title-enter`, requested its title-dialog review at 19:38:53.739Z,
then its resulting main-menu review at 19:39:02.710Z. Both exact receipts were
submitted after viewing their fresh captures. Command 6 ACKed successfully at
19:39:09.784Z, before its 19:39:31.969Z deadline. Command 7 was enqueued later,
at 19:39:16.952Z. No command was enqueued before the preceding successful ACK.
All subsequent requested reviews were also viewed and receipted in time.

The original completed 138 consecutive complete 64-step ACKs through step 8832.
Command 10 successfully reviewed current Custom Game hover at step 8832. Its
capture shows the highlighted right-hand towers, “Custom Game” heading and
“Customize your own Crusader game.” description. Command 11, `route-gesture`,
failed at 19:40:29.223Z with
`single exact preloaded Worker target/session prerequisite`. The callback
observer never armed and no Custom Game DOWN or UP was sent. The final input
queue, active/last input and button mask were drained. The only game mouse
press was the preceding ordinary balanced Crusader menu press.

## Cause and offline repair

The old attachment selected by preloaded Worker URL and required exactly one
candidate. Final state records four live same-URL Workers with init slots
0, 1, 2 and 3. Page observation records six original module sends, slots 0–5,
all with the same URL and module hash. The old page-side send check also counted
all those same-URL sends together. Both checks conflated the main guest's
owning Worker with auxiliary guest threads.

The repaired attachment reads each exact preloaded target/session report before
arming. Each report must contain one consistent init/instantiation history. It
requires exactly one slot-0 owner with pre-instantiation installation, no entry
error, endpoint 1 and current thread 1. A read-only getter exposes that existing
instance identity before start. Missing, replaced, foreign or ambiguous owners
remain terminal. The existing start guard checks thread identity again, and all
subsequent RPCs retain exact target/session/object checks. The page's unique
compile/send guard now counts slot-0 sends; auxiliary slots cannot supply its
proof and duplicate slot-0 sends still fail. Module/memory binding inside the
original before-first-script installer is unchanged.

Offline replay uses the recorded four-Worker/six-send topology and reproduces
the old rejection, then proves the repaired attachment arms only the unique
owner. Report getter values absent from the historical capture are explicit
fixture assumptions, not retrospectively claimed runtime observations. Nine
negative cases reject before arming: wrong endpoint, thread or installation
time; foreign session; missing or duplicate owner; replacement init; malformed
auxiliary history; and duplicate slot-0 send. An executable wrong-init fixture
also exposed a missing optional getter on rejected auxiliary entries; the
report getter now safely returns no identity for those entries. Both-module
executable tests exercise the valid pre-start slot/endpoint/thread getters and
the rejected-init path. This repair is offline only and was not retried live.

The actual ACK-aware command client also passed the focused two-review transport
preflight. It refuses advancement at both review requests and after receipts
without a successful ACK. Frozen byte-identical captures now display the newest
SHA-matched filename instead of an older startup filename. The display test
uses authentic unchanged PNG bytes; neither change creates or accepts a review.

## Validation and closure

Validation covers 35 local contract negatives and actual foreign-process
rejection, normal/abnormal closure fixtures, title/menu/ChooseType recognition
and before-input negatives, 26 historical routes, 20 before-input gates, ten
post-move review/freshness negatives, four dependent-gesture negatives, 27 hover
pixel negatives, four opacity negatives, and both-module executable callback,
branch, scene/setup fixture parity and owning guards. The shell suite passes
22 negatives. The final locked full build passed after the causal repair.
Offline fixtures and menu progress are not gameplay evidence.

The contract binds this assignment and rejects the prior missed-review
assignment. Chrome/cleanup cutoffs are 22:45Z/22:48Z, with unchanged 720-second
browser, 60-second bootstrap, 40-second command and full 180-second cleanup
reserve. Host, boot, PID start time, candidate, manifest, exact run and nonce
remain bound. Frozen/lifecycle/immutable queue, scene/opacity/presentation/
freshness, per-gesture ACK/drainage and first-fault guards remain intact.

Normal direct-CDP closure observed actual Chrome 1004312 exit 0, signal null,
at 19:40:29.366Z. Node 1004268 and the owned process groups are absent, HTTP34319
refuses connections, and the correct flock is available. Wrapper exit was
separately recorded as 0. The owned profile was removed after closure proof.
The local resource was explicitly released at 19:41:24Z. Box ID/state/expiry
are NA; the coordinator retains future-box and shutdown ownership.

Next requires a separately authorized original using the tested owner-discovery
repair. It must repeat all timely reviews and guards before the first balanced
Custom Game press. No setup, enabled preset or enabled Start has been observed
in this attempt, and existing terminal scene/readiness guards grant none.
