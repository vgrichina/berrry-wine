# SuperTux: personally reviewed airborne neutral settle

The review client now offers `neutral-settle-200` after personal review of the
exact latest native Pause image. It requires `nativePaused=true`,
`grounded=false`, `airborne=true`, and a nonempty frame-specific review. The
page enables this choice for the airborne attestation and retains grounded
review for all five existing directional/jump choices. Every new capture clears
the attestations. No image analysis, automatic route, or landing claim is added.

The choice sends `kind=neutral-settle`, `keys=[]`, `holdMs=200` through the
existing numbered transport and actual production composition. The persistent
controller accepts that exact combination only: native Escape resume, a fixed
200 ms neutral wait, native Escape Pause, then the composed driver's existing
fresh screenshot. No directional/jump events are dispatched during the settle.
The resulting Pause and grounding states remain UNKNOWN until personal review
of the new capture; a transport completion does not prove landing or survival.
Ordinary empty-key actions remain rejected. Ordinary actions also enforce the
grounded attestation at controller admission.

Identity pins, latest capture matching, original timestamps, single-use capture
tokens and command IDs, the 12-second freshness bound, runtime deadline/caps,
ACK bounds, independent UP, real outstanding transport promises, and sticky
first UNKNOWN remain in force. Cancellation, staleness or identity replacement
after resume prevents another DOWN. A settle does not refresh its supporting
image or authorize a following ordinary action.

Evidence: `scratch/runs/20261109-supertux-reviewed-airborne-settle-0116/`.
All checks were offline, using Node fixtures only:

- `controller-02-final.log.gz`: 30 actual Node-owner cases passed, including
  the fixed neutral wait with only two Escape pairs, ordinary empty-key refusal,
  wrong neutral duration/keys/observation, stale/future capture, worker/module
  replacement, cancellation during neutral wait, insufficient deadline,
  independent UP/late ACK failures, and capture replay.
- `client-03-final.log.gz`: 15 control groups passed with 14 real Node children.
  The actual composed production `execute` function ran through the numbered
  consumer. All five ordinary choices retained their exact key sequences;
  neutral settle produced only Escape resume/pause and a fresh capture/token.
  The shipped page's rendering/gating ran in a DOM fixture. HTTP authentication,
  CLI lifecycle, stale/identity/image/latest/token rejection, and immutable
  first client UNKNOWN were exercised. Every child was awaited with stream EOF.
- `composition-01.log.gz`: actual Node transport/lifecycle test passed,
  including pending DOWN surviving the ordinary CDP timeout, independent UP,
  sticky stale refusal without success ACK, provider identity negatives, and
  terminal drain. Composition forwards the explicit neutral kind.
- `build-final.log.gz`: `flock /tmp/wine-build.lock bash tools/build.sh` passed.
  CPU SHA-256 stayed
  `a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.

The initial client harness omitted the production function's `sha` dependency;
that offline fixture failed before input and its log is retained. The corrected
second run passed; the final run added all ordinary choices and DOM gating.
Unchanged accepted historical controls were verified and reused by PATH+HASH
in `reused-pathhash.json.gz`. Source recovery uses Git SHA and small own patches,
without source/media/module archives. Free disk remained above 1.5 GB.

No box, original, browser runtime, worker agent, peer file edit, or deployment
was used. Box ID/state/expiry and stop receipt are inapplicable (none created).
The next separately authorized gameplay run can personally review a fresh
airborne Pause frame, choose one settle, and inspect its fresh result. Actual
landing, onward movement, exit, and model deliberation within 12 seconds remain
unverified; historical status-143 and other UNKNOWN limits are unchanged.
