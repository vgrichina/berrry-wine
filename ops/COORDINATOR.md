# Wine Ops coordinator operating policy

This policy records the user-directed worker, context, and compute workflow.
Apply it to the host coordinator instructions and worker launch prompts; a file
in Git alone does not change a running session. User instructions and enforced
access controls take precedence. Public deployment needs its existing authorization.

## Dispatch and context

- The coordinator assigns games and bounded tasks. Use at most **two** production
  workers; the ceiling is not a target. Serialize shared integration and heavy
  runtime tests. Respect laptop and other agents' ownership.
- Start a fresh worker for each new task; same-task clarification is allowed.
  Workers do not spawn agents or refill the queue.
- Worker automatic compaction is **200,000 total-context tokens**. Coordinator
  compaction is **48,000 tokens of growth after the carried prefix**. These are
  compaction triggers, not spending budgets or instructions to stop a task.
- Verify launcher flags and runtime behavior. On the current host, native child
  spawn inherited the coordinator threshold despite role configuration; use the
  independent `scratch/usage-watch/start-worker.py` launcher until corrected and
  verified. Do not claim config inspection proves runtime inheritance.
- Each task names its exact input revision, owned paths, outcome, relevant tests,
  resource allocation, dependencies, completion notification, and stop condition.
  Runtime tasks must also name the box, expiry, and shutdown owner before launch.

## Wait for outcomes

The worker launcher writes `result.json` and `final.txt`, then queues completion
to the coordinator. `notification.json` records delivery success or failure.

After dispatch, record the worker ID, task, output directory, expected completion
or next check time, and return to an interruptible completion wait. Keep the goal
active while useful work runs. A live worker is not a blocked goal. Do not end
minute-long turns with "still running" and immediately start another goal turn.
Use the host's supported wait mechanism within its tool limits.

- Wake for worker completion, user/Telegram input, a changed dependency, or an
  overdue-worker check. Do not repeatedly reread full logs, source, the backlog,
  disk measurements, or unchanged receipts while waiting.
- If completion delivery is unavailable, use a narrow fallback check no more
  often than every **10 minutes**, unless a task deadline, safety condition, or
  user request requires sooner. Check result existence, notification failure,
  process liveness, and bounded new output before deciding whether to intervene.
- Read Telegram entries after the cursor on wake. Background inbox monitoring
  and the existing watchdog remain enabled; do not create model turns solely to
  read an unchanged cursor.
- Review each result once. Reuse exact-revision evidence already accepted; rerun
  checks when inputs change, evidence is missing, or a specific concern warrants
  it. Independent review should target correctness gaps, not repeat packaging.
- Send status updates for material progress or changed blockers. A queued
  instruction is delivered, not necessarily consumed: require acknowledgement
  before relying on a live worker to change a destructive lifecycle action.

## Test-box lifecycle and build failures

The **coordinator owns shutdown**. A worker must leave its assigned test box
running on completion, a recoverable failure, or handoff, unless its original
task explicitly delegates shutdown or an emergency requires stopping. Include
this rule in the launch prompt rather than correcting it after the task starts.

Keep the same running box through bounded repair and retest when practical.
Before another expensive build, run available cheap prerequisite checks against
the exact candidate; do not call their success a full build or gameplay result.
Record the first real failure, fix that dependency, and retest. Preserve useful
staging and artifacts across handoffs instead of rebuilding the environment.

The coordinator snapshots/stops when work is complete, no useful authorized
follow-up exists, the failure cannot be resolved in the current allocation, or
expiry is imminent. Retain a finite TTL and a shutdown checkpoint; do not leave
compute running indefinitely. Verify actual box state before assigning it.

A denied `sandbox.resume` applies to that operation. Do not retry it unchanged,
alter credentials to evade it, or treat it as evidence that all runtime work is
forbidden. A separately authorized fresh box is a distinct task allocation:
prepare the concrete task first, verify permitted creation/exec, and record its
new identity. Never assume an old access receipt proves current availability.

## Blockers, publication, and efficiency

Record each blocker's diagnostic, affected tasks, owner, and observable resume
condition. Keep user holds separate from technical errors. A Git host-key error
needs trusted-host/authentication repair, not a blanket publication ban; retain
strict verification. Existing commit/push/merge authorization still requires
review, relevant checks, current remote-main reconciliation, and verified refs.
Do not force-push shared branches or treat a local commit as remote backup.

The 30-minute usage review should compare concrete outcomes with coordinator
requests, repeated waits, setup retries, and duplicate reviews. Cached input is
a subset of input, not an additional count or free work. Report quota with its
sample time; do not convert a percentage into an invented token balance.

If status-only turns recur, correct waiting behavior immediately. If no eligible
work remains after checking dependencies, record one concise checkpoint and wait
for a dependency/user event; do not repeatedly rebuild the same blocker report.
