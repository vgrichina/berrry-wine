# Q3 prelaunch import repair — 2026-11-08

The actual retained 2325 launch wrapper fails before its barrier: it imports
`native_startup_barrier`, but the pinned provider is
`tools/native-startup-barrier.py`. Historical scripts and evidence are preserved.
`tools/q3-native-prelaunch.py` replaces that launch wrapper for future runs and
loads the provider with `spec_from_file_location` at its exact pinned path.
It retains the exclusive original claim, runtime parent log, PID/start target
and actual wait/stdio EOF receipt. It does not allocate a box.

Prepare a fresh run's `runtime-pins.json.gz`, including this wrapper, the chosen
runtime script, `tools/native-startup-barrier.py` and
`tools/native_kernel_custody.py` along with the full runtime provider graph.
Before allocation, execute the actual wrapper locally:

```sh
python3 -B tools/q3-native-prelaunch.py "$ROOT" "$FRESH_CHECK_RUN" "$RUNTIME" --check-only
```

The check writes exclusive manifest/barrier receipts into that fresh check
directory, executes real barrier publish/require and binds the actual runtime's
top-level import statements. The runtime is compiled for syntax, but its body
is not executed during the check. This catches both the hyphenated barrier
defect and missing runtime imports before claim/spawn. A later separately
authorized runtime uses a different fresh run directory and the same wrapper
without `--check-only`, with final provider verification and the existing
independent watchdog/supervisor requirements. Do not execute the historical
2325 launch-code.py or reuse its run destination. Check-only receipts cannot
authorize changed providers or substitute for the final remote barrier.

The focused control executes the exact historical wrapper to reproduce its
ModuleNotFoundError, then executes the new production wrapper via runpy.
It traces the actual barrier functions and uses a Python audit hook to refuse
process creation/exec and network access. The ordinary launch path reaches
the real Popen boundary and is refused there; its claim is only a local control
artifact. Native supervise/ptrace entry is also refused. Real custody imports
bind without native startup. Negative controls cover wrong provider hash,
changed manifest after publish, a missing required provider, and an absent
runtime import. Each fails before spawn; check-only creates no original claim.
No repaired import or barrier implementation is duplicated in a mock.

Evidence: `scratch/runs/20261108-q3-prelaunch-import-repair-2332/`.
Initial and final focused controls and locked builds pass. The final run retains
PID/start target publication in the reusable wrapper. Logs are gzip from their
first stored byte with unique destinations. The independent deadline board
watchers, test/build children, and their stdout EOF are actually awaited.
Exact Git SHA plus small owned patches provide recovery; accepted unrelated
2248/2305 PATHHASH controls are verified and reused, without rerunning native,
browser, composition, media or module controls. Q2 and SuperTux files are untouched.

Limits: this proves prelaunch Python imports and barrier call-site binding,
not execution of the runtime body, native custody, browser readiness/close,
GL arming, CDP delivery, game input or visible Q3 progress. Existing UNKNOWN,
untraced clone and nonleader limitations remain. No box allocation, original
runtime, old-box access, source archive, media/module copy, deployment, clock
or cap change, peer deletion, RAM gate, or agent launch occurred. /home free
samples exceeded 1,500,000,000 bytes; no continuous floor claim is made.

Box ID: NONE; state NOT_CREATED; expiry null; stop receipt N/A.
SuperTux2330 retains the sole heavy runtime slot. Next is a separately authorized
Q3 run using the new wrapper after its final full provider barrier; this single
offline implementation task stops after commit and authenticated pull/push.
