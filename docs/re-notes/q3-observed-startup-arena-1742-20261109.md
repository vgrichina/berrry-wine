# Q3 observed startup and arena, 1742

Offline composition and full generated-caller transport checks pass. Native
startup cause and arena movement/firing remain unverified. No production
repair is justified by the available evidence. This task stops with a concrete
runtime prerequisite blocker, not a gameplay or causal-repair success.

Evidence: `scratch/runs/20261109-q3-observed-startup-arena-1742/`.
Recover source from `gitbase.txt` and `relevant-uncommitted.patch` (empty for
the tested production paths); `owned.patch` preserves this note. No source tree
or media archive was made. Only four small retained Python inputs and generated
run-specific callers/runtimes accompany the logs and manifests.

## Actual current composition

The production preparation CLI authenticated 942 providers and 327 media paths
from the current published foreign closure, including transport diagnostics
published in `52f03da3f`. Fresh manifest SHA-256:
`ba56bbb0dabd877805389b1ce503458f7d05b726537a7ae2665cf5de480ce6a9`.
`fresh-composition-verification.json` records source commit, exact primary and
compat module identities, and existing media paths/SHA/size. All provider bytes
were independently read and checked against the manifest. The primary remains
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`;
compat remains
`ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf`.

The run-local retained control input is authenticated as an offline composition
input only. Its historical allocation/release functions were not executed and
are not qualified for reuse. No box, watchdog lease, Chrome, game, original
launcher, input or screenshot was started for this task. Child Node stand-ins
in the offline tests are explicitly not browsers.

## Validation and limits

- `q3-page-session-startup.test.cjs`: all 16 full generated-relative-caller
  cases and bounded transport controls pass. Exact post-transform send bytes
  correlate with public inbound bytes and consumer resolve/reject settlement.
  Synchronous settlement can precede send-return. Callback identity, thrown
  error identity, failed observer writes, 512-row bounds, 96 scheduling samples,
  late unmatched replies and unchanged 20-second first-failure behavior pass.
  The controlled delayed-inbound case measured 420.573142 ms from send-return
  to public message entry and 111.053549 ms maximum separate Node scheduling
  excess. These are peer-control observations, not new native measurements.
- `q3-current-foreign-closure.test.cjs`: actual CLI, staged generated caller,
  Git-free real consumer compile, and 27 refusal controls pass.
- `q3-versioned-native-lifecycle.test.py`: both actual generated prelaunch /
  custody / staged paths pass at DRIVER_PREFLIGHT before Chrome; separate
  stdout/stderr EOF, actual waits, kernel drain and independent test-watchdog
  join pass. These do not qualify native browser cleanup.
- `q3-checkpoint-caller-integration.test.py --foreign-closure`: production
  preparation and actual generated owning caller, sticky first failure,
  read-only joins and independent test-watchdog join pass.
- `q3-local-interactive-controller.test.py` with this run's fresh generated
  checkpoint caller: full selected import and actual retained original launch
  branch pass, including real Session, command branch, first-failure refusal
  and separate actual wait/EOF. No later native capture was requested.
- `flock /tmp/wine-build.lock bash tools/build.sh`: pass, `build.log`.
- Additional `q3-arena-command-boundary.test.cjs` with the current foreign
  selector: **FAIL**, TypeError reading `owner.method`, scenario line 128,
  reached from the fixed-late case. The baseline completed. Static inspection
  shows the harness extracts `function send` and receive into a VM but omits
  the startup diagnostic declarations inserted before `function send`; the
  current send references `startupOutbound` and `startupSettlement`. Its empty
  wire does not establish a complete production-caller failure. The full
  generated-caller suite above installs those declarations and passes. This
  failed sliced-harness check is retained, was not rerun, and is not counted
  as an arena gate pass. No test/provider edit or speculative repair was made.

Send-return proves only synchronous API return. Public inbound entry follows
WebSocket buffering/decoding and Node dispatch; neither proves socket flush,
browser receipt/dispatch/completion, kernel ingress or renderer pause. The
retained 1648 native request-6 reply was late after its deadline and Browser.close
ACK, but lacks the newly published lower transport and scheduling observations.
Replaying its envelopes cannot reconstruct missing native timing. No flags,
duplicate sessions or peer timing are used to infer a browser-internal cause.

## Runtime prerequisite blocker

ReturnFire1727 published RELEASE STOP at 17:43:24Z. Its retained normal-stop
receipt reports `bx_pvye6uwx` archived, unforced completed
`stop_55f2286b5ccd0f58` at `2026-11-09T17:40:07.350Z`; initial archiveAfter was
`2026-11-09T17:54:19.014Z`, final archiveAfter null, expiresAt not returned.
However, its `lifecycle-failure.json` explicitly records supervisor tool exit
143, `watchdogJoined:false`, `normalDelegateJoined:false`, and missing terminal
records. Its strict validation fails at missing `supervisor-terminal.json`.
`predecessor-gate.json` hashes these exact retained records; no fresh API query
or independent historical join is claimed here.

The coordinator's 17:43:04 messageboard clarification proposed proceeding from
archived state and absent processes while preserving the failed historical
join. Those observations cannot satisfy this task's explicit user prerequisite
requiring exact shutdown/watchdogjoin before allocation. No direct owner/user
instruction changing that prerequisite reached this worker. Nox1733 also
reported no allocation because of this missing join and was still finalizing
when the blocker was recorded. No new allocation was made.

Own box ID/state/expiry/stop receipt: **NOT_CREATED / not applicable**. Own
runtime watchdog wait, browser cleanup, native EOF and custody are NOT_CREATED,
not inferred passes. The next runtime needs an explicit owner revision of the
irrecoverable predecessor-join prerequisite or genuine missing join evidence,
then both final releases and all unchanged fixture gates. The separate sliced
arena harness failure also needs a scoped repair and validation before being
claimed as a passing check. Original arena movement/fire remains unattempted.
