# MDK2 construction main ownership repair

Evidence is `scratch/runs/20261104-mdk2-main-ownership-repair/` (RUN).
This finite assignment diagnoses the rejection demonstrated by `d35a29196`
and authorizes one fresh original attempt after repairing its real dependency.

The accepted `6d5121b5` barrier treated `wine.guestWorker` as a WorkerLink.
The actual pinned `host.js` assigns a GuestThreadHost there. Its `readExports`
delegates to `.link` and returns a plain values object, just as original
`mainState` expects. Slot, endpoint identity and pending queue instead belong
to `.link`. Thus reading thread1 through the wrapper can succeed while reading
the wrapper's nonexistent slot fails `foreign main ownership`. The previous
live rejection did not retain its rows; this is a reproduced production-contract
defect, not a retrospective assertion about that missing row or a guest fault.

The repair takes identity and read-only exports from the actual main `.link`.
It requires slot0, endpoint1, thread1. Before/after checks preserve the full
frozen status and queues, lifecycle/startup fences, thread table and record
identity, wrapper/link/physical worker identity, endpoint and slot identity,
and frozen budget. Local-main exports are rejected. Malformed unsigned export
values reject. Rejection diagnostics include the concrete owner rows obtained
so far and are saved before the driver throws, with no guest work admitted.

Executable contract tests load hashchecked production GuestThreadHost and
WorkerLink classes from original Git commit `1329b1ba`. The real wrapper,
`readExports`, `_ask`, `_onMessage` and pending-map drainage execute against
explicit offline exportsRead transport fixtures for main and file workers.
The original barrier reproduces its rejection on this actual wrapper. The
repaired barrier retains main0/endpoint1/thread1 and file1/endpoint2/thread2.
Foreign/replaced/malformed/queued/lifecycle/changed-clock negatives reject.
Existing real shipped-Worker/native observer tests and actual composed-command
tests remain in the same suite. A command negative proves rejection rows are
persisted before any trace start or construction slice.

This is explicitly a NEW driver candidate. `candidateResolver(hash)` composes
the fixed `da862db13` resolver in memory, checking its full SHA and the original
accepted entry blob, then admitting only the separately recorded current driver
SHA. It does not change original runtime pins. All111 helpers, observer de6,
four original Git dependencies, original432 filesystem/full HTTP bodies and
retained cffc/580f modules are independently checked. A dedicated-process test
executes all432 filesystem and432 actual HTTP checks. Nothing is staged over
the checkout, and no retained helper/evidence is edited.

The finite local contract binds the real host/boot/PID/start ticks, checkout,
fresh run, driver/local candidate hashes and fresh random nonce. The candidate
Git and relevant binary diff are recorded separately from retained runtime
module references. Absolute Chrome cutoff is19:20Z, cleanup19:23Z; admission
requires the full360+180 seconds. Additional local limits are360 browser,
60 aggregate bootstrap and40 per command seconds; original guards/caps still
apply. Normal closure owns late browser launch completion. Tests reverse all
explicit source seams back to the original composed bytes and execute timeout
and actual original Python-child controls. No fabricated box identity is used.

The exact dedicated launch command is prepared in RUN/launch-command.sh and
RUN/launch.cjs before runtime: exclusive inherited soleLOCAL flock, explicit
candidate resolver, createResolver/installAdapter, local.install, then the same
run entry with its original author/operator/next/control route. Stronghold
menu-onward's normal heavy release at17:56:38Z (after GL17:51:56Z release) is
required before lock acquisition. One launch, fresh personal capture review
before dependent input, measured Escape, independent NewGame/Medium and the
input-free construction16 quantum remain mandatory. First concrete fault,
unexpected scene, cap or deadline stops the attempt; no retry or guard bypass.

Git is the source archive: exact GitSHA, relevant binary diff and owned new-file
patches only. Media/modules stay existing path/SHA references, without copies,
source snapshots or tars. Box ID/state/expiry: NA; coordinator owns future
allocation/shutdown. Live outcome and final validation are appended below.

## One fresh result: useful window exhausted before title

The sole attempt used current main
`10482c4d89d6a85721aad4b2e50af851f77e94a2` plus
RUN/attempted-relevant.patch and RUN/attempted-new-note.patch. Driver candidate
SHA256 is `41c4991661f6409562854b0ed134b31701384e603415ba76a742f35b2ef24fca`;
local candidate SHA256 is
`4373c96e62e59995c69092ca62174830839a777a3f178ef73472666290313d14`.
RUN/attempt-candidate.json records their hashes, original retained module
references and explicit resolver provenance separately. Original432 filesystem
and432 full HTTP checks,111 helpers, four Git dependencies, observer and
retained modules passed before the one browser launch.

Release issuance was17:59:48.642Z to real NodePID862541/start186239358,
closeBy18:05:48.642Z, recoverBy18:08:48.642Z. The original quit checkpoint was
18:02:48.642Z, preserving its180-second recovery reserve. ChromePID863002
reported Chrome151 and loopback38321; bootstrap completed within60 seconds.
Every dependent startup capture was personally viewed: teal desktop0,
gray512/1024, black1536, Interplay splash2048, BioWare splash2560, black3072.
The timing differs from the previous attempt; its cause is unproved. A previous
title at3072 is not permission to classify these fresh black pixels as title.

The last shot command54 completed at18:02:43Z, before the useful-window
checkpoint. At personal review that checkpoint had elapsed, while no MDK2
title was visible. This is the first concrete bound reached: STOP before
Escape or any selection input. No original input/control assertion failed,
and no failed command was retried. All56 ACKs, including original quit55,
succeeded; all48 startup64-step commands completed, totaling3072. There was
no Escape/NewGame/Medium, construction barrier,16-slice quantum, trace, Level
or gameplay observation. The ownership repair is executable offline evidence;
this live attempt does not establish its construction-time acceptance.

Original quit closed Chrome normally at18:03:01.011Z, exit0/signal null, and
Node exited0. Both PIDs are absent, HTTP38321 returns ECONNREFUSED and the sole
local flock is available. Release was announced at18:03:39Z; the closed owned
Chrome profile was removed. Legacy original `boxLeftRunning:true` is not an
allocation claim. Actual box ID/state/expiry remain NA.

Validation passes92 integration tests and27 local tests, including the real
original Python child and bootstrap, actual compiled Worker observer controls
for both retained modules, and the mandatory locked full build. Final test
outputs now target this assignment's RUN rather than the suite's historical
output default. Initial task-generated fixtures/results were moved here;
retained original compressed evidence remains unchanged. Concrete offline
negative rows are in RUN/ownership-negatives.jsonl. Final patches and Git
context are separate from the exact attempted candidate above.
Final hardening also compares the entire frozen status, including tickMs and
any new status fields, and fences replacement of the worker backend. These
additional negative tests were completed after the live stop, without a retry.

Next: investigate the demonstrated original startup timing within existing
bounds before a separately authorized fresh attempt. Do not retry this run or
infer a guest failure, Lua completion, construction progress or gameplay.
