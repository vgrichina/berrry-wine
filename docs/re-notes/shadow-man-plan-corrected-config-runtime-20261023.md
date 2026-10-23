# Shadow Man full-plan preflight blocker, 2026-10-23

The corrected offline orchestration gate derives the accepted full plan as
224 entries: 216 immutable and eight fixed; the separate ctl-pin receipt gives
217 immutable. Nine negative plan/dependency cases reject. Static full-command
dependencies and canonical identity are checked without guest execution.

The first actual blocker is **three stale fixed-helper pins**: accepted plan
requires dependency-preflight.cjs 2135B, hash_gate.py 3767B and
prepare_mutable.py 2239B; current donor files are 2150B, 4174B and 2408B with
different SHA256 values. No upload occurred. The diagnostic fixture passes its
assertions but explicitly records passAll=false/donorIdentityPass=false and
stagingAuthorized=false. No donor or accepted manifest was rewritten.

All 2,083 restored originals/186,399,681B remain exact against the reused accepted
destination receipt. No recovery, transfer, tmpfs, clone or guest session ran.
Ordinary defaults/OK, settings persistence, actual Play and gameplay remain
unqualified. Historical callback limitations remain explicit.

Full hashes, rejected cases, read-only handback, allocation, verifier and
publication receipt are under
`scratch/runs/20261023-shadow-man-plan-corrected-config-runtime/` in this task's
isolated checkout. REPORT.md explains the acceptance boundary and exact command.
Box bx_fn7pn7yg remains healthy RUNNING, expiry03:46:00.580Z, no owned groups;
coordinator owns shutdown. No source changes or main integration.
