# Army Men actual-call observer: blocked before implementation

Base fetched from origin/main: `4169ebe6bc1ab858719ce12127ded7d8c0b2ef64`.
Isolated branch `task/army-bltfast-observer-oct20`, worktree
`/tmp/wa-army-bltfast-observer-oct20`. Shared HEAD/index and laptop
Warcraft III/Heroes II work were not changed.

## Concrete stop condition

After the sparse checkout (src, lib, tools, test, docs), `df -B1 /tmp`
reported **2,090,979,328 available bytes**, below the **2,147,483,648-byte**
floor. Implementation stopped. No cleanup, binary copies, build, guest,
browser, runtime polling, box action, settings probe or worker launch occurred.
Only this small source finding/blocker receipt was retained after the check.
The sparse checkout was too broad for the available headroom.

There is **no executable diagnostic deliverable**, no fixture-test result,
and no claim to have captured a call return or explained terrain stripes.
The next prerequisite is coordinator-provided disk headroom or a separately
authorized source workspace above the floor. No remote-runtime command is
offered: actual capture wiring and callsite provenance are unfinished.

## Source findings to preserve

Read the required agent instructions, CLAUDE.md, messageboard, Army Men notes,
conformance report and retained scroll-entry evidence:
`scratch/runs/20261019-army-men-scroll-entry-remote-v1/`
(`review.json`, `controller.js`, `child.json`, `pins.json`,
`army-men-scroll-entry-plan.js`, relevant `output.log` entries).

* `test/run.js` trace-at handling records registers/guest bytes at the
  breakpoint. The retained eight observations at original `0x4074f1`
  are pre-push observations, not return events. The plan limits hits to eight.
* `src/09b-dispatch.wat` increments `api_calls` and emits the API entry name
  before loading stack arguments. Resolved COM/ordinal calls emit
  `0xC0DE0000 | api_id` before that name. The ordinary dispatch path calls
  `host_log_api_exit` after the generated handler and nonvolatile restoration,
  gated by `api_log_on`. This is a candidate **post-handler** observation,
  not proof that the guest caller's next instruction executed.
* Generated dispatch entry 1008 calls `handle_IDirectDrawSurface_BltFast`.
  That handler reads argument six at ESP+24 and resolves both surface objects.
  It reads backing from `DxObject.misc1`, dimensions, pitch and bpp from
  the object. Its early-return paths demonstrate why success cannot be
  inferred from an entry trace; EAX must be observed.
* `tools/jig-owning-api-observer.js` already wraps `log`, `log_i32` and
  `log_api_exit`, authenticates dispatch counters, keeps a nesting stack,
  and records entry ESP/return address and exit EAX/ESP. It has callbacks
  for entry/exit and explicit incomplete-pair states. This is reusable
  plumbing to evaluate, not a validated Army capture adapter.
* `test/run.js:dxLookupThis` resolves the object's slot from guest this+4
  and uses `RegionMap.BASE.DX_OBJECTS`, rather than a copied movable base.
  Its existing decoder reports width/height/bpp/pitch. It does not capture
  bounded pre/post backing pixels for the same invocation.

Still missing: original instruction-byte/disassembly proof connecting
`0x4074f1` through the six pushes and indirect call to its actual return
address; an authenticated owning-instance adapter; validated backing reads;
invocation-paired pre/post snapshots and initial corruption evidence.
Actual pitch, backing, format and HRESULT remain **unknown**. The prior
downward overlap fix does not establish the cause of upward terrain stripes.

Validation for this documentation-only receipt: source inspection and
`git diff --check`. No test or capture-helper completion is claimed.
