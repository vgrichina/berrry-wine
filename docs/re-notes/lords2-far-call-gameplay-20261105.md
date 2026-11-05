# Lords II far-call diagnostic preparation — 2026-11-05

This continuation stopped at a build review gate before any original setup
observation. No installation, gameplay screenshot, rejected original selector,
or emulator repair was established. The previous original failure and its
limitations remain as recorded in
[the recovered-original note](lords2-recovered-original-gameplay-20261105.md).

Evidence: `scratch/runs/20261105-lords2-far-call-gameplay/`.
Preparation began on `2cc9b1289e36eb4bda88be6c5b56f4664961ebab`; the generated
baseline and attempted diagnostic build used main
`4f87ab4cee26386ab6a730c534291f447bed05e2` plus the retained exact patches.
Git is the source archive. No source snapshots, media copies, archives,
guest-byte edits, boxes, or additional workers were used.

Strong1135 released at 13:28:00 UTC, followed by keyed-mip1230 at 13:40:29 UTC.
Fresh `release-gate.json` independently checked predecessor process absence,
known profiles, eight closed ports, four free locks and no active heavy runtime
before shared edits or tests. Historical unknown exit statuses remain unknown.

The existing fatal-selector integer log is hidden by browser verbose filtering.
Furthermore, cooperative child imports replace that logger with a filtered API
logger. The actual prior original failure was in child T1, so both paths need
coverage. A prepared failure-only WAT record adds the indirect operand address,
offset, rejected selector, return address and segment context before the return
frame is pushed. Its prepared browser collector synchronously retains the live
selector and module ownership tables before returning to the existing CS trap.
The existing CS validity check was left intact. A separate prepared read-only
observer captures operand/object/vtable/stack bytes at that same import call.
None of these preparations constitutes a validated or published implementation.

`test-win16-far-fault.js` uses the existing generated `neLifecycleImage` fixture
helper and production Wasm/browser imports. Its six prepared cases cover an
invalid selector, null selector with wrapped ES addressing, a loaded DLL owner,
valid internal NE relocations with ordinary/wrapped addressing, and an imported
KERNEL thunk. The baseline failed as expected because no fault record survived
with verbose disabled. The repaired regression was **not run**.

At **2026-11-05T13:44:51.260674Z**, this operation exited 1:

```sh
flock /tmp/wine-build.lock bash tools/build.sh > scratch/runs/20261105-lords2-far-call-gameplay/build-diagnostic.log 2>&1
```

The repository's automated callback-ownership census reported:

```text
changed producer host.js:host-file (sha256); review its lifetime
```

The worker conservatively interpreted this lifetime-review gate as covered by
the task's automatic-risk-review stop rule and notified the coordinator on the
messageboard at 13:46:10 UTC. This was a repository build gate, **not a tool
approval rejection**. The census was not updated or bypassed, and the build was
not retried. Compilation had not begun. The existing canonical module used by
the generated baseline had SHA-256
`b1e7fad7a43aae382b9cd3aff51df383b782e5e8a1d285aef1fb847864dc326a`;
no original browser loaded a new module.

The exact proposal remains in `relevant-uncommitted.binarydiff` and
`owned-new-test.patch`, with the build log, baseline log, `review-stop.json`,
prepared observer and bounded ordinary setup recipe. The worker removed only
its own unvalidated shared implementation hunks and new test, leaving the
published emulator unchanged. This note is the only committed change.

The remaining work is to resolve the review-gate classification and required
host lifetime review through the coordinator, then validate the retained
diagnostic proposal before any original observation. The actual original
selector and relocated target remain missing; no semantic repair is justified
by this continuation. Runtime and file release details are retained in the run's
publication/cleanup record. Box ID/state/expiry: N/A.
