# Q3 native reply boundary: offline causal isolation, 1145

Cause **UNKNOWN**. No production routing/scheduling change is justified by the
retained evidence. Added `tools/q3-native-input-cause-diagnostic.cjs`, a standalone
verified evidence comparison and opt-in generated-fixture diagnostic. No native
retry, box/browser/guest contact, input, capture, ACK or timeout replay occurred.

The comparison reads retained1055 and retained1130 retrieval manifests, verifies
stored and original SHA-256/size plus gzip CRC, joins actual request spans by
trace ID and execution markers by session AND request ID, and reconstructs the
two pinned compositions from Git in memory. Git bases are
`c052bc921140a7afdd6545d2ee6e47955dbb671d` and
`8d7443761494bc1f643538c118ce0f2ded2c13ce`. Among shared runtime pins only
`tools/q3-native-driver-composition.cjs` differs. Generated send/receive bodies
and fixture source are identical; controls differ following the1110 repair.
Physical-reader validation/PAGE_READ changed; this is not proof of causation.
The wire observer, execution observer, physical handlers and delivery helper
pins match. Full actual Input payload bytes were not retained; the immutable
helper supplies the same Enter100ms dispatch construction in both runs.

1055 DOWN109 and UP113 each have a raw matching successful reply and caller
settlement around3ms. This proves that positive input operation, not the whole
native fixture or actual owning-caller Boat cancellation. 1130 DOWN193 and
independent UP194 use the same page session as successful owner evaluation192.
That evaluation returned in2ms, execution context1, marked synchronous JS
0.425ms. No prior CDP request is active at DOWN entry. The last guest/render
bytecode reads took70/72ms versus117/114ms before successful1055 input; their
duration does not establish starvation. The observations do not cover arbitrary
page work or Chromium scheduling during the subsequent100ms input interval.

1130 helper firstFailure is11:13:55.746Z at101.073ms. Pending IDs are193/194;
the terminal rejects both actual promises rather than receiving replies.
Independent UP socket entry is100.164ms after DOWN socket entry. Only4.186ms
elapse between UP socket return and transport terminal. An absent UP reply in
that censored interval does not establish a second UP-specific defect. Neither
request has a raw matching reply, samples are empty, and no later Input or
capture entry follows helper failure. Socket return cannot establish browser
receipt, DOM dispatch, application timing or actual physical hold. No observed
session/context switch or unfinished owner evaluation explains DOWN failure.

The diagnostic adds bounded DOM capture and renderer-handler entry/return/throw
markers around the actual generated fixture's call into production renderer
handlers, plus passive buffered Long Task entries. It uses the existing console
stream, adding executionContextId to its existing rows; it adds no socket
observer, CDP request, timer, guest read or promise settlement. At most64 console
markers include sequence/cap and page performance clock/timeOrigin. Diagnostic
sink failures are swallowed. Existing fixture identity checks, trusted-event
checks, physical handlers, exception handling and preventDefault remain intact.
The installed observer/listener has the generated document's lifetime.

For a **separately authorized** future fixture diagnostic, preserve existing
preloads and add `--require ./tools/q3-native-input-cause-diagnostic.cjs` after
composition and before execution-boundary, with `Q3_NATIVE_INPUT_CAUSE=1`.
Keep `Q3_INPUT_WIRE=1`. Existing console rows can then distinguish delivered DOM
input, entered/returned/thrown synchronous renderer callbacks and reported long
tasks. Correlate session AND execution context; markers do not carry a CDP
request ID. Console delivery may lag execution, and absence or cap exhaustion
is UNKNOWN. Handler return cannot prove CDP response production or physical
hold; a long task alone cannot establish input starvation. This is an executable
diagnostic for the missing DOM/handler boundary, not an unchanged native retry.

Offline tests execute real generated listener source and production renderer
methods: old missing/new observed boundaries; identical physical/queue results;
untrusted-event and lifecycle refusal; synchronous handler exception; failing
sink; unavailable Long Task API; bounded output; separate same-number contexts
on different sessions; duplicate/source-drift refusal; real composition + wire
+ execution preload chain. No synthetic reply is supplied by these controls.
Retained comparison checks 1055 success against1130 failure and pending IDs.
The unchanged delivery regression suite passed, including independent releases
and sticky failure. `flock /tmp/wine-build.lock bash tools/build.sh` passed.

Reproduce the offline comparison from the repository root:

```
node tools/q3-native-input-cause-diagnostic.test.cjs
node tools/q3-native-input-cause-diagnostic.cjs \
  scratch/runs/20261109-q3-observed-input-native-gameplay-1055 \
  scratch/runs/20261109-q3-corrected-controls-native-1130
```

Evidence: `scratch/runs/20261109-q3-native-reply-cause-repair-1145/`, exact Git
base plus small owned patch; no source archives, media or module copies.
Free home remained above1.5GB. Shared clients, custody, Q2, Redline, host/WAT,
HeroesII and CLAUDE were untouched. No agents, workers or deployment.

No new box: ID/state/expiry/stop receipt NOT_CREATED. Prior1130
`bx_7qr5v9tq`, UUID `ad488975-a20c-4d24-a602-2492a1501cf5`, remains retained
UNCONTACTED: ARCHIVED/PHYSICAL_DRAINED, `stop_17435ea1ce1bcb6f`, initial expiry
11:38:07.314Z. Whole actual native fixture NOT_PASS; actual Boatcancel
NOT_PROVEN remains prerequisite before original consequence. Separate EOF,
independent UP, first-failure stickiness, all bounds and physical requirements
remain unchanged. Native REVOKED; allwriters/edictABA UNKNOWN. SingleTaskSTOP.
