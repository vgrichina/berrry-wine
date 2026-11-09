# Q2 health-history gameplay diagnostic, 1020

First concrete blocker: the actual fixture caller fails **before remote spawn**.
`Caller.main` rebinds task `ROOT` to `/home/user/q2-health-history-1020`; the
run-only launch branch then evaluates the local `BASE_RUN/health-preload.cjs`
with `.relative_to(ROOT)`, raising ValueError. Its `noReplay` record is retained.
No Chrome, native fixture, original game, guest input, capture or retry ran.
No actual fixture PASS, pane-route progress or first-HP-decrease diagnostic.
Damage cause remains UNKNOWN; native lifetime REVOKED, all-writers/edict ABA UNKNOWN.

Evidence: `scratch/runs/20261109-quake2-health-history-gameplay-1020/`.
The prepared passive-health integration and exact 724-provider closure were
staged, with unchanged 724-era provider proofs and published damage reader.
Authored health100/100/98 integration, damage-reader tests, generated invocation
valid/missing/wrong-root preflights and locked build passed. Those offline
preflights used a local ROOT and missed the production caller's root rebinding.
The failed actual caller exited 1 while its stdin writer remained open; its
actual wait and separate stdout/stderr EOFs are retained. Cleanup has no children.
Independent remote census confirms no runtime was launched; runtime waits are
inapplicable, not inferred from absent PIDs. No ordinary quit or held-high,
release-zero, capture-ACK fixture claim is made.

Next task must compute the preload's repository-relative path before the caller
rebinds ROOT (as FIXTURE_PROVIDER already does), then exercise the actual main
namespace with `ROOT=Path(REMOTE)` in its generated-invocation preflight. Keep
local source root and staged runtime root distinct. The entire actual native
fixture must pass before an original diagnostic. This task's terminal remains
sticky. The original0940 HP100-to-98 gap is still 287 server frames; it cannot
attribute damage to the final 100ms action or identify an attacker/contact cause.

Verified prior UUID `a41ddbef-46c3-438b-b613-0e717108ee87` ARCHIVED through API,
with `stop_d50489c589a758b2` completed 10:16:36.417Z and retained initial expiry
10:40:16.165Z. Created one box after the observable independent immutable
25-minute UUID watchdog was armed:

- Box `bx_8xta4w6s`, UUID `d28d470b-d359-478e-8960-5a794e4cbe6a`.
- Initial expiry/archiveAfter **2026-11-09T10:47:30.920Z**.
- Final **ARCHIVED**, normal stop **`stop_b39b6e9f3761e79c`**, completed
  **2026-11-09T10:23:49.292Z**, forced false, error null.
- Final archiveAfter null; expiresAt not returned.

Both unique remote staging barriers were independently retrieved and SHA/size
reread before delegated normal shutdown. Transport, lifecycle and watchdog
actual waits and separate EOF records are retained. Exact RUNTIME_OWN/RELEASE
was published on the board; the sole heavy runtime slot is released to Redline.
Free `/home` remained above 1.5 GB (about 2.24 GB at shutdown). Evidence logs
were compressed as written; the two small barrier JSONs required no compression.
No source-tree archive, local media/module copy, shared client/custody/host/WAT
or peer-game edit, worker, agent or deployment. Git SHA plus small run-input
binary patch and relevant production diff provide recovery. Only this note is
published. SingleTaskSTOP.
